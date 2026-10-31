import random
import torch
import torch.nn as nn
import torch.nn.functional as F

PAD, SOS, EOS, UNK = 0, 1, 2, 3
EMB, HID, ATT = 64, 128, 64

class Encoder(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, EMB, padding_idx=PAD)
        self.rnn = nn.GRU(EMB, HID, batch_first=True, bidirectional=True)
        self.fc = nn.Linear(HID * 2, HID)
    def forward(self, src, lens):
        e = self.emb(src)
        packed = nn.utils.rnn.pack_padded_sequence(e, lens.cpu(), batch_first=True, enforce_sorted=False)
        out, h = self.rnn(packed)
        out, _ = nn.utils.rnn.pad_packed_sequence(out, batch_first=True, total_length=src.size(1))
        h = torch.tanh(self.fc(torch.cat([h[0], h[1]], dim=1)))
        return out, h

class DecoderNoAttn(nn.Module):
    """Model 1: decoder hanya tahu hidden state akhir encoder."""
    def __init__(self, vocab_size):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, EMB, padding_idx=PAD)
        self.rnn = nn.GRU(EMB, HID, batch_first=True)
        self.fc = nn.Linear(HID, vocab_size)
    def forward(self, y, h, enc_out, mask, enc_proj=None):
        e = self.emb(y).unsqueeze(1)
        out, h_new = self.rnn(e, h.unsqueeze(0))
        return self.fc(out.squeeze(1)), h_new.squeeze(0), None

class BahdanauAttention(nn.Module):
    def __init__(self):
        super().__init__()
        self.W_enc = nn.Linear(HID * 2, ATT, bias=False)
        self.W_dec = nn.Linear(HID, ATT, bias=False)
        self.v = nn.Linear(ATT, 1, bias=False)
    def forward(self, h, enc_out, mask, enc_proj=None):

        if enc_proj is None:
            enc_proj = self.W_enc(enc_out)
        score = self.v(torch.tanh(enc_proj + self.W_dec(h).unsqueeze(1))).squeeze(2)
        score = score.masked_fill(~mask, torch.finfo(score.dtype).min)
        return F.softmax(score, dim=1)

class DecoderAttn(nn.Module):
    """Model 2: decoder + Bahdanau attention."""
    def __init__(self, vocab_size):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, EMB, padding_idx=PAD)
        self.attn = BahdanauAttention()
        self.rnn = nn.GRU(EMB + HID * 2, HID, batch_first=True)
        self.fc = nn.Linear(HID + HID * 2 + EMB, vocab_size)
    def forward(self, y, h, enc_out, mask, enc_proj=None):
        e = self.emb(y).unsqueeze(1)
        a = self.attn(h, enc_out, mask, enc_proj)
        ctx = torch.bmm(a.unsqueeze(1), enc_out)
        out, h_new = self.rnn(torch.cat([e, ctx], dim=2), h.unsqueeze(0))
        logits = self.fc(torch.cat([out.squeeze(1), ctx.squeeze(1), e.squeeze(1)], dim=1))
        return logits, h_new.squeeze(0), a

class Seq2Seq(nn.Module):
    def __init__(self, encoder, decoder):
        super().__init__()
        self.enc, self.dec = encoder, decoder

    def forward(self, src, lens, trg, teacher_forcing=0.5):
        mask = src != PAD
        enc_out, h = self.enc(src, lens)
        enc_proj = self.dec.attn.W_enc(enc_out) if isinstance(self.dec, DecoderAttn) else None
        B, T = trg.shape
        outputs = []
        y = trg[:, 0]
        for t in range(1, T):
            logits, h, _ = self.dec(y, h, enc_out, mask, enc_proj)
            outputs.append(logits)
            y = trg[:, t] if random.random() < teacher_forcing else logits.argmax(1)
        return torch.stack(outputs, dim=1)

    @torch.no_grad()
    def translate(self, src, lens, max_len=60):
        """Greedy decoding hingga batas panjang."""
        self.eval()
        mask = src != PAD
        enc_out, h = self.enc(src, lens)
        enc_proj = self.dec.attn.W_enc(enc_out) if isinstance(self.dec, DecoderAttn) else None
        y = torch.full((src.size(0),), SOS, dtype=torch.long, device=src.device)
        preds, atts = [], []
        for _ in range(max_len):
            logits, h, a = self.dec(y, h, enc_out, mask, enc_proj)
            y = logits.argmax(1)
            preds.append(y)
            if a is not None:
                atts.append(a)
        preds = torch.stack(preds, 1).cpu().tolist()
        attn = torch.stack(atts, 1).cpu().numpy() if atts else None
        out = [p[:p.index(EOS)] if EOS in p else p for p in preds]
        return out, attn
