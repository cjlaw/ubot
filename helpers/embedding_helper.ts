type EmbedFn = (texts: string[]) => Promise<Float32Array[]>;

// Test seam — not for production use.
let _embedderOverride: EmbedFn | null = null;
export function _setEmbedder(fn: EmbedFn | null): void { _embedderOverride = fn; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: ((texts: string[], opts: Record<string, unknown>) => Promise<any>) | null = null;

async function initPipeline(): Promise<void> {
	// Dynamic import defers onnxruntime-node load until the model is actually needed.
	// Tests inject a fake via _setEmbedder so this path never runs in unit tests.
	const { pipeline, env } = await import('@huggingface/transformers');
	if (process.env.HF_CACHE_DIR) env.cacheDir = process.env.HF_CACHE_DIR;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	_pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as any;
}

export async function embed(texts: string[]): Promise<Float32Array[]> {
	if (_embedderOverride) return _embedderOverride(texts);
	if (!_pipeline) await initPipeline();
	// Process one at a time — batching OOMs inside the container due to attention matrix size.
	const result: Float32Array[] = [];
	for (const text of texts) {
		const output = await _pipeline!([text], { pooling: 'mean', normalize: true });
		const dim: number = output.dims[output.dims.length - 1];
		result.push(output.data.slice(0, dim));
	}
	return result;
}

export async function embedOne(text: string): Promise<Float32Array> {
	const [vec] = await embed([text]);
	return vec;
}

// Vectors are pre-normalized, so cosine similarity equals the dot product.
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
	return dot;
}
