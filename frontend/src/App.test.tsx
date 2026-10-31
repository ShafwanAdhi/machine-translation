import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { tokenCount } from './api';

afterEach(cleanup);

test('token counter follows notebook punctuation preprocessing', () => {
  expect(tokenCount('  Saya,bisa!  ')).toBe(4);
  expect(tokenCount(' ')).toBe(0);
});

test('translate defaults to both models and shows sentence BLEU separately', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
    device: 'cpu', token_count: 3, reference_provided: true,
    results: [{model: 'no_attention', translation: 'you see ?', latency_ms: 15, oov_count: 0, bleu: {'BLEU-1': 1, 'BLEU-2': 1, 'BLEU-3': 1, 'BLEU-4': 0}},
      {model: 'attention', translation: 'you look ?', latency_ms: 18, oov_count: 0, bleu: {'BLEU-1': .5, 'BLEU-2': 0, 'BLEU-3': 0, 'BLEU-4': 0}}],
  }) })));
  render(<App />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Teks Indonesia'), 'kau lihat ?');
  await user.click(screen.getByText('Referensi Inggris'));
  await user.type(screen.getByLabelText('Referensi terjemahan Inggris'), 'you see ?');
  await user.click(screen.getByRole('button', {name: /Terjemahkan/}));
  await waitFor(() => expect(screen.getByText('you look ?')).toBeTruthy());
  expect(screen.getAllByText('BLEU per input')).toHaveLength(2);
  const request = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
  expect(request.models).toEqual(['no_attention', 'attention']);
  expect(request.reference).toBe('you see ?');
  await user.clear(screen.getByLabelText('Teks Indonesia'));
  expect(screen.queryByText('you look ?')).toBeNull();
});

test('network failures are announced without fake predictions', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Koneksi terputus.'); }));
  render(<App />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Teks Indonesia'), 'halo');
  await user.click(screen.getByRole('button', {name: /Terjemahkan/}));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Koneksi terputus.'));
});
