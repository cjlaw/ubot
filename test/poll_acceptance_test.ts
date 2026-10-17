import { expect } from "chai";
import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { data, execute } from "../commands/poll.js";
import { normalizeDuration } from "../helpers/poll_helper.js";

type PollOptions = Record<string, string | number | boolean | null | undefined>;

const mockInteraction = (options: PollOptions) => {
  const replies: Record<string, unknown>[] = [];
  let deferred = false;
  let edited = false;
  return {
    reply: async (payload: Record<string, unknown>) => { replies.push(payload); },
    deferReply: async () => { deferred = true; },
    editReply: async () => { edited = true; },
    getReplies: () => replies,
    wasDeferred: () => deferred,
    wasEdited: () => edited,
    options: {
      getString: (key: string) => options[key] as string | null | undefined,
      getInteger: (key: string) => options[key] as number | null | undefined,
      getBoolean: (key: string) => options[key] as boolean | null | undefined,
    },
  };
};

const run = async (options: PollOptions) => {
  const interaction = mockInteraction(options);
  await execute(interaction as unknown as ChatInputCommandInteraction);
  const replies = interaction.getReplies();
  expect(replies).to.have.lengthOf(1);
  return { interaction, payload: replies[0] as any };
};

describe("#command: poll (acceptance)", () => {
  describe("-criterion 1: native poll payload", () => {
    it("criterion 1: builds a native poll with question, A/B/C-emoji answers in order, duration 48, multiselect true", async () => {
      const { interaction, payload } = await run({
        question: "Best snack?",
        answer1: "Chips",
        answer2: "Pretzels",
        answer3: "Popcorn",
        duration: 48,
        multiselect: true,
      });
      expect(payload.poll.question.text).to.equal("Best snack?");
      expect(payload.poll.answers).to.deep.equal([
        { text: "Chips", emoji: "🇦" },
        { text: "Pretzels", emoji: "🇧" },
        { text: "Popcorn", emoji: "🇨" },
      ]);
      expect(payload.poll.duration).to.equal(48);
      expect(payload.poll.allowMultiselect).to.equal(true);
      expect(payload.flags).to.equal(undefined);
      expect(interaction.wasDeferred()).to.equal(false);
      expect(interaction.wasEdited()).to.equal(false);
    });
  });

  describe("-criterion 2: answer count", () => {
    it("criterion 2: rejects fewer than 2 answers with an ephemeral error and no poll", async () => {
      const { payload } = await run({ question: "Lonely?", answer1: "Yes" });
      expect(payload.flags).to.equal(MessageFlags.Ephemeral);
      expect(payload).to.not.have.property("poll");
    });

    it("criterion 2: treats empty-string answers as missing and rejects when fewer than 2 remain", async () => {
      const { payload } = await run({ question: "Lonely?", answer1: "Yes", answer2: "" });
      expect(payload.flags).to.equal(MessageFlags.Ephemeral);
      expect(payload).to.not.have.property("poll");
    });

    it("criterion 2: accepts 5 answers and assigns 🇦 through 🇪 in order", async () => {
      const { payload } = await run({
        question: "Pick one",
        answer1: "One",
        answer2: "Two",
        answer3: "Three",
        answer4: "Four",
        answer5: "Five",
      });
      expect(payload.poll.answers).to.deep.equal([
        { text: "One", emoji: "🇦" },
        { text: "Two", emoji: "🇧" },
        { text: "Three", emoji: "🇨" },
        { text: "Four", emoji: "🇩" },
        { text: "Five", emoji: "🇪" },
      ]);
    });

    it("criterion 2: skips a gap in answer slots, preserving order and lettering sequentially", async () => {
      const { payload } = await run({
        question: "Gap?",
        answer1: "First",
        answer2: "Second",
        answer4: "Fourth",
      });
      expect(payload.poll.answers).to.deep.equal([
        { text: "First", emoji: "🇦" },
        { text: "Second", emoji: "🇧" },
        { text: "Fourth", emoji: "🇨" },
      ]);
    });
  });

  describe("-criterion 3: duration", () => {
    const cases: [number | null | undefined, number][] = [
      [1, 1],
      [768, 768],
      [48, 48],
      [0, 24],
      [769, 24],
      [1.5, 24],
      [null, 24],
      [undefined, 24],
    ];
    for (const [raw, expected] of cases) {
      it(`criterion 3: normalizeDuration(${raw}) returns ${expected}`, () => {
        expect(normalizeDuration(raw)).to.equal(expected);
      });
    }

    it("criterion 3: execute with duration unset produces a 24-hour poll", async () => {
      const { payload } = await run({ question: "Q", answer1: "A", answer2: "B" });
      expect(payload.poll.duration).to.equal(24);
    });

    it("criterion 3: execute with out-of-range duration falls back to 24 hours", async () => {
      const { payload } = await run({ question: "Q", answer1: "A", answer2: "B", duration: 1000 });
      expect(payload.poll.duration).to.equal(24);
    });
  });

  describe("-criterion 4: multiselect", () => {
    it("criterion 4: multiselect omitted defaults to allowMultiselect false", async () => {
      const { payload } = await run({ question: "Q", answer1: "A", answer2: "B" });
      expect(payload.poll.allowMultiselect).to.equal(false);
    });

    it("criterion 4: multiselect true sets allowMultiselect true", async () => {
      const { payload } = await run({ question: "Q", answer1: "A", answer2: "B", multiselect: true });
      expect(payload.poll.allowMultiselect).to.equal(true);
    });
  });

  describe("-criterion 5: permissions", () => {
    it("criterion 5: command has no default member permission gate", () => {
      const json = data.toJSON();
      expect(json.default_member_permissions == null).to.equal(true);
    });
  });

  describe("-criterion 6: option length limits", () => {
    const optionByName = (name: string) => {
      const json = data.toJSON();
      const option = (json.options ?? []).find((o: any) => o.name === name) as any;
      expect(option, `option ${name}`).to.not.equal(undefined);
      return option;
    };

    it("criterion 6: question option is capped at 300 characters", () => {
      expect(optionByName("question").max_length).to.equal(300);
    });

    for (const name of ["answer1", "answer2", "answer3", "answer4", "answer5"]) {
      it(`criterion 6: ${name} option is capped at 55 characters`, () => {
        expect(optionByName(name).max_length).to.equal(55);
      });
    }
  });
});
