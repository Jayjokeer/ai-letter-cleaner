import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const apiKey = process.env.AI_KEY;

app.get('/', async(req, res) => {
    try{

    
    const prompt = 'Write a poem about the sea in the style of Shakespeare.';
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "mistralai/mistral-7b-instruct",
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response) {
    throw new Error(`Hugging Face API error: `);
  }

  const data = await response.data;

    return  res.send(data);
    } catch (error) {
        console.error("Error fetching from Hugging Face API:", error);
      return  res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});