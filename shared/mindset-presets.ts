// Original prompts; lens names and numbering follow the cited 2008 edition.
const MINDSET_PRESETS = [
	{
		schemaVersion: 1,
		id: "schell-2008-starter",
		version: "1.0.0",
		name: "Jesse Schell — Game Design Lenses (starter)",
		icon: "🔍",
		domains: ["game"],
		source: {
			title: "Jesse Schell, The Art of Game Design: A Book of Lenses",
			edition: "2008",
			url: "https://rsd2-alert-durden-connections.weebly.com/uploads/6/7/1/6/6716949/3-the-art-of-game-design-a-book-of-lenses_3.pdf",
			coverage:
				"Eight selected lenses; original questions, not the complete collection.",
		},
		guidance: "Examine specific mechanics through player experience.",
		entries: [
			{
				id: "lens-1",
				number: 1,
				name: "Essential Experience",
				topics: ["feeling", "experience", "emotion"],
				questions: ["Which single feeling should this mechanic strengthen?"],
			},
			{
				id: "lens-2",
				number: 2,
				name: "Surprise",
				topics: ["encounter", "predictable", "surprise"],
				questions: [
					"Where could a predictable encounter gain an unexpected twist?",
				],
			},
			{
				id: "lens-4",
				number: 4,
				name: "Curiosity",
				topics: ["exploration", "traversal", "discovery"],
				questions: ["What unanswered clue makes this route worth exploring?"],
			},
			{
				id: "lens-14",
				number: 14,
				name: "Risk Mitigation",
				topics: ["prototype", "uncertainty", "risk"],
				questions: [
					"Which uncertain mechanic needs the cheapest playable test?",
				],
			},
			{
				id: "lens-16",
				number: 16,
				name: "The Player",
				topics: ["audience", "controls", "accessibility"],
				questions: ["Who might struggle with this control scheme?"],
			},
			{
				id: "lens-31",
				number: 31,
				name: "Challenge",
				topics: ["difficulty", "combat", "skill"],
				questions: [
					"How does this encounter stretch the player's current skill?",
				],
			},
			{
				id: "lens-40",
				number: 40,
				name: "Reward",
				topics: ["reward", "rewards", "upgrade"],
				questions: ["Which behavior does this reward encourage next?"],
			},
			{
				id: "lens-49",
				number: 49,
				name: "Visible Progress",
				topics: ["progression", "progress", "upgrades"],
				questions: [
					"How will players notice improvement before reaching the goal?",
				],
			},
		],
	},
];
export default MINDSET_PRESETS;
