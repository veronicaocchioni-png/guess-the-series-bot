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

    const temp = Math.min(Math.max(Number(temperature) || 0, 0), 1.5);

    let style;
    if (temp <= 0.4) {
      style = "Use a formal, precise and straightforward tone. Give factual, accurate clues.";
    } else if (temp <= 0.9) {
      style = "Use a friendly, balanced tone. Mix factual clues with a little personality.";
    } else {
      style = "Use a playful, humorous and unconventional tone. Give creative, quirky clues with jokes and unexpected angles.";
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
Style: ${style}`;

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
