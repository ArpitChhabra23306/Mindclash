import { GoogleGenAI } from '@google/genai';

// Lazy initialization - creates AI client on first use after env vars are loaded
let aiClient = null;
const getAI = () => {
    if (!aiClient) {
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
};

/**
 * AI Moderation - Check message for toxicity and inappropriate content
 */
export const moderateMessage = async (text) => {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a content moderator for a debate platform. Analyze the following message and return a JSON response.

Message: "${text}"

Analyze for:
1. Toxicity (hate speech, harassment, threats)
2. Personal attacks
3. Profanity
4. Off-topic content
5. Spam

Return ONLY valid JSON (no markdown, no code blocks):
{
  "isAppropriate": boolean,
  "toxicityScore": number (0-100, where 0 is safe, 100 is highly toxic),
  "flags": ["list", "of", "issues"],
  "reason": "brief explanation if flagged",
  "suggestedAction": "none" | "warn" | "mute" | "remove"
}`,
        });

        const responseText = response.text;

        // Parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { isAppropriate: true, toxicityScore: 0, flags: [], reason: '', suggestedAction: 'none' };
    } catch (error) {
        console.error('Gemini moderation error:', error);
        return { isAppropriate: true, toxicityScore: 0, flags: [], reason: '', suggestedAction: 'none' };
    }
};

/**
 * Fact Check - Verify claims made in debate
 */
export const factCheck = async (claim, topic) => {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a fact-checker for a debate on "${topic}". Analyze this claim:

Claim: "${claim}"

Evaluate the factual accuracy. Return ONLY valid JSON (no markdown, no code blocks):
{
  "isFactual": boolean,
  "accuracy": number (0-100),
  "verdict": "true" | "mostly_true" | "mixed" | "mostly_false" | "false" | "unverifiable",
  "explanation": "brief explanation",
  "sources": ["relevant source or context"],
  "correction": "if false, what's the accurate information"
}`,
        });

        const responseText = response.text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { isFactual: true, accuracy: 50, verdict: 'unverifiable', explanation: 'Unable to verify', sources: [] };
    } catch (error) {
        console.error('Gemini fact-check error:', error);
        return { isFactual: true, accuracy: 50, verdict: 'unverifiable', explanation: 'Unable to verify', sources: [] };
    }
};

/**
 * Score Argument - Analyze debate argument quality
 */
export const scoreArgument = async (text, side, topic, previousArguments = []) => {
    try {
        const context = previousArguments.length > 0
            ? `Previous arguments in this debate:\n${previousArguments.map((a, i) => `${i + 1}. [${a.side}]: ${a.text}`).join('\n')}`
            : 'This is the opening argument.';

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are an expert debate judge scoring an argument.

Topic: "${topic}"
Side: ${side} (${side === 'pro' ? 'in favor' : 'against'})
${context}

Current Argument: "${text}"

Score this argument on each criterion (0-100). Return ONLY valid JSON (no markdown, no code blocks):
{
  "logic": {
    "score": number,
    "feedback": "brief feedback"
  },
  "evidence": {
    "score": number,
    "feedback": "brief feedback"
  },
  "persuasion": {
    "score": number,
    "feedback": "brief feedback"
  },
  "rebuttal": {
    "score": number,
    "feedback": "brief feedback on how well they addressed opponent's points"
  },
  "clarity": {
    "score": number,
    "feedback": "brief feedback"
  },
  "overall": number,
  "strengths": ["list", "of", "strengths"],
  "weaknesses": ["areas", "to", "improve"]
}`,
        });

        const responseText = response.text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return {
            logic: { score: 70, feedback: 'Good logical structure' },
            evidence: { score: 60, feedback: 'Could use more evidence' },
            persuasion: { score: 65, feedback: 'Reasonably persuasive' },
            rebuttal: { score: 50, feedback: 'N/A for opening' },
            clarity: { score: 70, feedback: 'Clear presentation' },
            overall: 63,
            strengths: ['Clear structure'],
            weaknesses: ['Could use more evidence']
        };
    } catch (error) {
        console.error('Gemini scoring error:', error);
        return {
            logic: { score: 70, feedback: 'Unable to analyze' },
            evidence: { score: 60, feedback: 'Unable to analyze' },
            persuasion: { score: 65, feedback: 'Unable to analyze' },
            rebuttal: { score: 50, feedback: 'Unable to analyze' },
            clarity: { score: 70, feedback: 'Unable to analyze' },
            overall: 63,
            strengths: [],
            weaknesses: []
        };
    }
};

/**
 * Generate Debate Topic
 */
export const generateTopic = async (category = 'General', difficulty = 'intermediate') => {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a unique, engaging debate topic.

Category: ${category}
Difficulty: ${difficulty}

The topic should be:
- Debatable with valid points on both sides
- Current and relevant
- Not too broad or too narrow
- Thought-provoking

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "The debate topic as a clear statement",
  "description": "Brief context about the topic",
  "proPosition": "What the PRO side argues",
  "conPosition": "What the CON side argues",
  "keyPoints": {
    "pro": ["point 1", "point 2", "point 3"],
    "con": ["point 1", "point 2", "point 3"]
  },
  "tags": ["relevant", "tags"]
}`,
        });

        const responseText = response.text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return {
            title: 'Should AI be regulated by governments?',
            description: 'A debate on government oversight of artificial intelligence',
            proPosition: 'AI should be regulated to ensure safety and ethical use',
            conPosition: 'Regulation would stifle innovation and progress',
            keyPoints: { pro: [], con: [] },
            tags: ['technology', 'ai', 'regulation']
        };
    } catch (error) {
        console.error('Gemini topic generation error:', error);
        // Return a random fallback topic when API fails
        const fallbackTopics = [
            {
                title: 'Should social media platforms be regulated by governments?',
                description: 'Debate on government oversight of social media',
                proPosition: 'Regulation protects users from misinformation and harmful content',
                conPosition: 'Regulation threatens free speech and innovation',
                keyPoints: { pro: ['User safety', 'Misinformation control'], con: ['Free speech', 'Innovation'] },
                tags: ['technology', 'politics', 'social media']
            },
            {
                title: 'Is remote work better than office work?',
                description: 'The future of work arrangements',
                proPosition: 'Remote work improves work-life balance and productivity',
                conPosition: 'Office work fosters collaboration and company culture',
                keyPoints: { pro: ['Flexibility', 'No commute'], con: ['Collaboration', 'Culture'] },
                tags: ['work', 'lifestyle', 'business']
            },
            {
                title: 'Should college education be free?',
                description: 'The economics and value of higher education',
                proPosition: 'Free education creates equal opportunities and skilled workforce',
                conPosition: 'Free education decreases quality and increases taxes',
                keyPoints: { pro: ['Equal access', 'Economic growth'], con: ['Quality concerns', 'Tax burden'] },
                tags: ['education', 'economics', 'policy']
            },
            {
                title: 'Is artificial intelligence a threat to humanity?',
                description: 'The risks and benefits of AI advancement',
                proPosition: 'AI poses existential risks that need immediate attention',
                conPosition: 'AI benefits far outweigh risks with proper development',
                keyPoints: { pro: ['Job loss', 'Control issues'], con: ['Medical advances', 'Efficiency'] },
                tags: ['technology', 'ai', 'future']
            },
            {
                title: 'Should voting be mandatory?',
                description: 'Civic duty versus personal freedom in democracy',
                proPosition: 'Mandatory voting ensures true representation',
                conPosition: 'Voting should remain a freedom, not an obligation',
                keyPoints: { pro: ['Full representation', 'Civic duty'], con: ['Personal freedom', 'Uninformed votes'] },
                tags: ['politics', 'democracy', 'rights']
            }
        ];
        return fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
    }
};

/**
 * Argument Assistant (Whisper Mode) - Help user build stronger arguments
 */
export const assistArgument = async (userDraft, side, topic, opponentArguments = []) => {
    try {
        const opponentContext = opponentArguments.length > 0
            ? `Opponent's arguments to address:\n${opponentArguments.join('\n')}`
            : 'No opponent arguments yet.';

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a debate coach helping a user strengthen their argument.

Topic: "${topic}"
User's Side: ${side}
${opponentContext}

User's Draft: "${userDraft}"

Provide helpful suggestions. Return ONLY valid JSON (no markdown, no code blocks):
{
  "suggestions": [
    "specific suggestion 1",
    "specific suggestion 2",
    "specific suggestion 3"
  ],
  "counterPoints": ["potential counter-arguments to address"],
  "evidence": ["relevant facts or statistics they could use"],
  "structureTip": "how to better structure their argument",
  "strengthRating": number (1-10)
}`,
        });

        const responseText = response.text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { suggestions: [], counterPoints: [], evidence: [], structureTip: '', strengthRating: 5 };
    } catch (error) {
        console.error('Gemini assistant error:', error);
        return { suggestions: [], counterPoints: [], evidence: [], structureTip: '', strengthRating: 5 };
    }
};

/**
 * Calculate Final Winner - Comprehensive debate analysis
 */
export const calculateWinner = async (debate) => {
    try {
        const proMessages = debate.rounds.flatMap(r =>
            r.messages.filter(m => debate.proTeam.some(p => p.user.toString() === m.sender.toString()))
        );
        const conMessages = debate.rounds.flatMap(r =>
            r.messages.filter(m => debate.conTeam.some(p => p.user.toString() === m.sender.toString()))
        );

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a debate judge determining the winner.

Topic: "${debate.topic.title}"

PRO Arguments:
${proMessages.map((m, i) => `${i + 1}. ${m.content}`).join('\n') || 'No arguments'}

CON Arguments:
${conMessages.map((m, i) => `${i + 1}. ${m.content}`).join('\n') || 'No arguments'}

Current Scores:
PRO: ${debate.scores.pro.total}
CON: ${debate.scores.con.total}

Determine the winner based on argument quality, evidence, rebuttals, and persuasiveness.
Return ONLY valid JSON (no markdown, no code blocks):
{
  "winner": "pro" | "con" | "draw",
  "finalScores": {
    "pro": number (0-100),
    "con": number (0-100)
  },
  "margin": number,
  "reasoning": "detailed explanation of the decision",
  "keyMoments": ["highlight 1", "highlight 2"],
  "feedback": {
    "pro": {
      "strengths": ["list"],
      "improvements": ["list"]
    },
    "con": {
      "strengths": ["list"],
      "improvements": ["list"]
    }
  }
}`,
        });

        const responseText = response.text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        // Fallback to score-based decision
        const proTotal = debate.scores.pro.total;
        const conTotal = debate.scores.con.total;
        return {
            winner: proTotal > conTotal ? 'pro' : conTotal > proTotal ? 'con' : 'draw',
            finalScores: { pro: proTotal, con: conTotal },
            margin: Math.abs(proTotal - conTotal),
            reasoning: 'Based on accumulated scores',
            keyMoments: [],
            feedback: { pro: { strengths: [], improvements: [] }, con: { strengths: [], improvements: [] } }
        };
    } catch (error) {
        console.error('Gemini winner calculation error:', error);
        const proTotal = debate.scores?.pro?.total || 0;
        const conTotal = debate.scores?.con?.total || 0;
        return {
            winner: proTotal > conTotal ? 'pro' : conTotal > proTotal ? 'con' : 'draw',
            finalScores: { pro: proTotal, con: conTotal },
            margin: Math.abs(proTotal - conTotal),
            reasoning: 'Based on accumulated scores',
            keyMoments: [],
            feedback: { pro: { strengths: [], improvements: [] }, con: { strengths: [], improvements: [] } }
        };
    }
};

/**
 * Performance Analytics - Detailed user analysis
 */
export const analyzePerformance = async (userId, recentDebates) => {
    try {
        const debatesSummary = recentDebates.map(d => ({
            topic: d.topic.title,
            side: d.proTeam.some(p => p.user.toString() === userId) ? 'pro' : 'con',
            won: d.winner?.team?.some(w => w.toString() === userId),
            scores: d.scores
        }));

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this debater's recent performance.

Recent Debates:
${JSON.stringify(debatesSummary, null, 2)}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "overallRating": number (1-100),
  "topStrengths": ["strength 1", "strength 2", "strength 3"],
  "areasToImprove": ["area 1", "area 2"],
  "recommendations": ["specific tip 1", "specific tip 2"],
  "bestCategory": "category name",
  "trend": "improving" | "stable" | "declining",
  "styleAnalysis": "brief description of their debate style"
}`,
        });

        const responseText = response.text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return null;
    } catch (error) {
        console.error('Gemini analytics error:', error);
        return null;
    }
};

/**
 * Generate Anonymous Alias
 */
export const generateAlias = async () => {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a creative, memorable anonymous debate alias.
It should be:
- Two words combined (adjective + noun)
- Mysterious and cool sounding
- Related to debate, thinking, or intellect
- Followed by a random 2-3 digit number

Return ONLY the alias as plain text, nothing else.
Examples: ShadowMind_42, SwiftLogic_88, SilentScholar_127`,
        });

        return response.text.trim();
    } catch (error) {
        console.error('Gemini alias generation error:', error);
        const adjectives = ['Shadow', 'Silent', 'Swift', 'Clever', 'Bold', 'Wise'];
        const nouns = ['Thinker', 'Scholar', 'Ninja', 'Master', 'Sage', 'Mind'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 900) + 100;
        return `${adj}${noun}_${num}`;
    }
};

/**
 * Rank Debate - Single AI call at end to rank all arguments and determine winner
 */
export const rankDebate = async (topic, proArguments, conArguments) => {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are an expert debate judge. Evaluate both sides' arguments and determine the winner.

Topic: "${topic}"

PRO SIDE ARGUMENTS:
${proArguments || 'No arguments submitted'}

CON SIDE ARGUMENTS:
${conArguments || 'No arguments submitted'}

Evaluate based on:
1. Logic and reasoning quality
2. Evidence and examples used
3. Persuasiveness
4. Addressing opponent's points
5. Overall argument strength

Return ONLY valid JSON (no markdown, no code blocks):
{
  "winner": "pro" | "con" | "draw",
  "proScore": number (0-100),
  "conScore": number (0-100),
  "reasoning": "2-3 sentence explanation of why this side won"
}`,
        });

        const responseText = response.text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { winner: 'draw', proScore: 50, conScore: 50, reasoning: 'Could not determine a clear winner.' };
    } catch (error) {
        console.error('Gemini rankDebate error:', error);
        return null; // Let socket fallback handle it
    }
};

export default {
    moderateMessage,
    factCheck,
    scoreArgument,
    generateTopic,
    assistArgument,
    calculateWinner,
    analyzePerformance,
    generateAlias,
    rankDebate,
};
