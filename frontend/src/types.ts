export type ModelId = 'no_attention' | 'attention';
export type Bleu = Record<string, number>;
export interface ModelStats {
  id: ModelId; label: string; parameters: number; train_pairs: number; validation_pairs: number;
  test_pairs: number; epochs: number; batch: number; eval_batch: number; training_device: string;
  amp: boolean; training_seconds: number; bleu: Bleu; bleu_by_length: Record<string, number>;
  selected_epoch: number; validation_loss: number; source_vocab_size: number; target_vocab_size: number;
}
export interface Epoch { epoch: number; train_loss: number; validation_loss: number }
export interface Benchmark {
  models: ModelStats[]; history: Record<ModelId, Epoch[]>;
  length_groups: {id: string; label: string; count: number; mean_source_words: number}[];
  errors: {type: string; no_attention: number; attention: number}[];
  position_errors: {position: string; no_attention: number; attention: number}[];
  attention_images: {key: string; title: string; artifact_key: string}[];
  artifacts: Record<string, {filename: string; content_type: string}>;
  method: Record<string, string | number | boolean>;
  test_count: number; qualitative_count: number;
}
export interface TranslationResult { model: ModelId; translation: string; latency_ms: number; oov_count: number; bleu: Bleu | null }
export interface TranslationResponse { results: TranslationResult[]; device: string; token_count: number; reference_provided: boolean }
export interface Prediction {
  id: number; source: string; reference: string; translations: Record<ModelId,string>;
  source_length: number; length_group: string; exact_matches: Record<ModelId,boolean>;
  review: Record<string, string | number | null> | null;
}
export interface PredictionPage {items: Prediction[]; total: number; page: number; page_size: number; pages: number}
