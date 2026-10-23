module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY on the server" });
  }

  try {
    const { messages, temperature, secret } = req.body || {};

    if (!Array.isArray(messages) || typeof secret !== "string" || !secret) {
      return res.status(400).json({ error: "Invalid request" });
    }

    // Max 1.2 keeps the creative answers readable
    const temp = Math.min(Math.max(Number(temperature) || 0, 0), 1.2);

    let style;
    if (temp <= 0.2) {
      style = "STYLE: very cold. Be extremely formal and literal, like an encyclopedia entry. Use short, dry, factual sentences. No jokes, no metaphors, no exclamation marks, no personality at all.";
    } else if (temp <= 0.5) {
      style = "STYLE: cool. Be polite, clear and professional. Give accurate, straightforward clues. Light and neutral tone, no jokes.";
    } else if (temp <= 0.8) {
      style = "STYLE: warm. Be friendly and conversational, like a helpful friend. Add a little personality, but keep the clues clear.";
    } else if (temp <= 1.0) {
      style = "STYLE: hot. Be playful and funny. Describe the clues with humor, fun comparisons and a bit of sarcasm. Use simple everyday English.";
    } else {
      style = "STYLE: very hot. Be wild, dramatic and hilarious, like an over-excited game show host. Use funny comparisons, silly exaggerations and unexpected angles for the clues. IMPORTANT: always use simple, everyday English and short sentences. Never use rare words, poetry or confusing wording.";
    }

    const systemPrompt = `You are the host of a game called "Guess the Series".
The secret TV series is: "${secret}".
Rules:
- Always answer in English, even if the user writes in another language.
- Never reveal the title until the user guesses it correctly or says they give up.
- Give ONE clue at a time, following this exact difficulty ladder:
  Clue 1: the genre and the decade it was released (very vague).
  Clue 2: a detail about the setting or the main character, without names.
  Clue 3: a memorable plot element or a famous scene, without spoilers of the ending.
  Clue 4: the number of seasons and a notable actor's role (not the name).
  Clue 5: a very obvious hint, such as a famous quote or the first letter of the title.
- Never mention the title, character names or actor names in clues 1-3.
- When the user makes a guess, say clearly whether it is correct or not.
- If the guess is correct, congratulate the user and tell them to press "New game" to play again.
- After 5 clues without a correct guess, offer to reveal the answer.
- Keep answers short (max 3 sentences).
- Whatever the style, the clue must always be easy to understand and factually correct.
${style}`;

    const safeMessages = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, 500)
    }));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: temp,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "OpenAI error" });
    }

    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
};
