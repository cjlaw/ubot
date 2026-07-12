import { expect } from "chai";
import { cosineSimilarity, _setEmbedder } from "../helpers/embedding_helper.js";
import { embedFilter } from "../helpers/episode_helper.js";
import type { Episode } from "../types.js";

// ─── cosineSimilarity ─────────────────────────────────────────────────────────

describe("#cosineSimilarity", () => {
	it("returns 1 for identical unit vectors", () => {
		const v = new Float32Array([1, 0, 0]);
		expect(cosineSimilarity(v, v)).to.equal(1);
	});

	it("returns 0 for orthogonal vectors", () => {
		const a = new Float32Array([1, 0]);
		const b = new Float32Array([0, 1]);
		expect(cosineSimilarity(a, b)).to.equal(0);
	});

	it("returns -1 for opposite unit vectors", () => {
		const a = new Float32Array([1, 0]);
		const b = new Float32Array([-1, 0]);
		expect(cosineSimilarity(a, b)).to.equal(-1);
	});

	it("returns the dot product for normalized vectors", () => {
		const a = new Float32Array([0.6, 0.8]);
		const b = new Float32Array([0.8, 0.6]);
		expect(cosineSimilarity(a, b)).to.be.closeTo(0.48 + 0.48, 1e-6);
	});
});

// ─── embedFilter ─────────────────────────────────────────────────────────────

const FIXTURE_EPISODES: Episode[] = [
	{
		number: 10,
		title: "Hades Interview",
		description: "An interview about Hades.",
		pubDate: null,
		playerUrl: "https://example.com/10",
		audioUrl: "",
	},
	{
		number: 9,
		title: "GOTY Discussion",
		description: "Game of the year picks.",
		pubDate: null,
		playerUrl: "https://example.com/9",
		audioUrl: "",
	},
];

// Deterministic fake: hades-related text → [1,0], everything else → [0,1].
const hadesEmbedder = async (texts: string[]) =>
	texts.map(t => t.toLowerCase().includes("hades")
		? new Float32Array([1, 0])
		: new Float32Array([0, 1]),
	);

describe("#embedFilter", () => {
	before(() => { _setEmbedder(hadesEmbedder); });
	after(() => { _setEmbedder(null); });

	const hadesVec = new Float32Array([1, 0]);
	const gotyVec = new Float32Array([0, 1]);
	const vectors = [hadesVec, gotyVec];

	it("ranks the semantically closest episode first", async () => {
		const results = await embedFilter(FIXTURE_EPISODES, vectors, "hades interview");
		expect(results[0].number).to.equal(10);
	});

	it("returns n results even when query matches nothing lexically", async () => {
		const results = await embedFilter(FIXTURE_EPISODES, vectors, "xyznotarealword");
		expect(results).to.have.length(2);
	});

	it("respects the n limit", async () => {
		const results = await embedFilter(FIXTURE_EPISODES, vectors, "hades interview", 1);
		expect(results).to.have.length(1);
		expect(results[0].number).to.equal(10);
	});
});
