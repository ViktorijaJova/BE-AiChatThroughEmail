// Import necessary modules
const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const Imap = require("imap");
const axios = require("axios");
require("dotenv").config();
let invitedEmail = '';  // Store the invited email temporarily
let messageId = '';     // Store the Message-ID for threading
let threadMessageId = ''; // Store the thread Message-ID

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Environment variables
const { EMAIL_USER, EMAIL_PASS, COHERE_API_KEY, PORT } = process.env;

// Nodemailer setup for SMTP email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

app.post("/send-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    // Generate a unique message ID for the first email
    messageId = `<${Date.now()}@sarahacademy.com>`;
    
    // Store the email of the user being invited
    invitedEmail = email;

    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "Welcome to Sarah Academy AI",
      text: "Hello! You've been invited to start a conversation with our AI. Reply to this email to begin the conversation.",
      headers: {
        "Message-ID": messageId,  // Set the Message-ID for the first email
      },
    };

    console.log("Sending invitation email to:", email); // Log the email that the invitation is being sent to

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: `Error sending email: ${error.message}` });
      }
      console.log("Email sent:", info.response);
      res.status(200).json({ message: "Invitation email sent successfully!" });
    });
  } catch (error) {
    console.error("Error sending email:", error.message);
    res.status(500).json({ error: "Internal server error while sending email." });
  }
});
let replyMessageId = ""; // Store the Message-ID of the user's reply
let recipientEmail = ""; // Store the recipient email dynamically
// Endpoint to process AI-generated responses using Cohere
app.post("/ai-conversation", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const email = invitedEmail;

  if (!email) {
    return res.status(400).json({ error: "Email address not found." });
  }

  try {
    console.log("Processing message for AI:", message);

    const apiRequest = {
      prompt: message,
      max_tokens: 150,
    };

    const response = await axios.post("https://api.cohere.ai/v1/generate", apiRequest, {
      headers: {
        Authorization: `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Cohere API Response Status:", response.status);
    console.log("Cohere API Response Data:", response.data);

    const aiResponse = response.data.generations[0]?.text || "Sorry, I couldn't generate a response.";
    console.log("AI Generated Response:", aiResponse);

    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "AI Response from Sarah Academy",
      text: `AI Response:\n\n${aiResponse}`,
      headers: {
        "In-Reply-To": messageId,   // Reference the original message for threading
        "References": messageId,    // Keep the thread intact for future replies
      },
    };

    console.log("Mail Options to be sent:", mailOptions);

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending AI response email:", error);
        return res.status(500).json({ error: "Error sending AI response email." });
      }
      console.log("AI response email sent:", info.response);
      threadMessageId = messageId; // Store the Message-ID for the thread
      messageId = threadMessageId; // Maintain threading for future emails
      res.status(200).json({ message: "AI response sent successfully!" });
    });

  } catch (error) {
    console.error("Error processing AI response:", error.message);
    res.status(500).json({ error: "Error generating AI response." });
  }
});

// IMAP email listener for incoming replies
const imap = new Imap({
  user: EMAIL_USER,
  password: EMAIL_PASS,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
});

function openInbox(callback) {
  imap.openBox("INBOX", true, callback);
}

function listenForReplies() {
  imap.once("ready", () => {
    openInbox((err) => {
      if (err) throw err;
      imap.on("mail", fetchLatestEmail);
    });
  });

  imap.on("error", (err) => console.error("IMAP Error:", err.message));
  imap.connect();
}

function fetchLatestEmail() {
    const fetch = imap.seq.fetch("*", { bodies: "TEXT", struct: true });
  
    fetch.on("message", (msg) => {
      msg.on("body", (stream) => {
        let buffer = "";
        stream.on("data", (chunk) => (buffer += chunk.toString("utf8")));
        stream.once("end", () => {
          console.log("Received Email:", buffer);
          handleUserMessage(buffer, msg);
        });
      });
    });
  
    fetch.once("end", () => imap.end());
  }

function handleUserMessage(rawEmail) {
  const userMessage = extractUserMessage(rawEmail);
  if (!userMessage) {
    console.error("No valid user message found in the email.");
    return;
  }
  console.log("User Message Extracted:", userMessage);
  sendToAI(userMessage, EMAIL_USER);
}

function extractUserMessage(rawEmail) {
  const lines = rawEmail.split("\n");
  const meaningfulLines = lines.filter((line) => !line.trim().startsWith(">") && line.trim());
  return meaningfulLines[0]?.trim() || null;
}

function sendToAI(userMessage, userEmail) {
  axios
    .post("http://localhost:5000/ai-conversation", { email: userEmail, message: userMessage })
    .then((response) => console.log("AI response sent successfully:", response.data))
    .catch((err) => console.error("Error in AI conversation:", err.message));
}

// Start listening for email replies
listenForReplies();

// Start the Express server
const SERVER_PORT = PORT || 5000;
app.listen(SERVER_PORT, () => {
  console.log(`Server running on port ${SERVER_PORT}`);
});
