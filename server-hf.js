const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
require("dotenv").config();
const cors = require("cors");
const Imap = require("imap");
const axios = require("axios");
const { inspect } = require("util");

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(cors());


// Nodemailer setup (SMTP for sending email)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Endpoint to handle email sending (Invitation email)
app.post("/send-email", async (req, res) => {
  const { email } = req.body;

  console.log(`Sending invitation to: ${email}`);

  try {
    // Send the initial invitation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to Sarah Academy AI",
      text: "Hello! You've been invited to start a conversation with our AI. Reply to this email to begin the conversation.",
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: `Error sending email: ${error.message}` });
      }
      console.log("Email sent:", info.response);
      res.status(200).json({ message: "Invitation email sent successfully!" });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error sending email" });
  }
});

// Endpoint to handle AI conversation
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.post("/ai-conversation", async (req, res) => {
    const { email, message } = req.body;
  
    try {
      const response = await axios.post(
        "https://api-inference.huggingface.co/models/gpt2", // Use the model of your choice
        { inputs: message },
        {
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          },
        }
      );
  
      const aiResponse = response.data[0]?.generated_text || "Sorry, I couldn't generate a response.";
  
      // Send the AI response via email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "AI Response from Sarah Academy",
        text: `AI Response:\n\n${aiResponse}`,
      };
  
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending AI response:", error);
          return res.status(500).json({ error: "Error sending AI response email" });
        }
        console.log("AI response sent:", info.response);
        res.status(200).json({ message: "AI response sent successfully!" });
      });
    } catch (error) {
      console.error("Error generating AI response:", error);
      res.status(500).json({ error: "Error generating AI response" });
    }
  });
  

// IMAP email listener for incoming replies
const imap = new Imap({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false,  // Allow self-signed certificates
  },
});

function openInbox(cb) {
  imap.openBox("INBOX", true, cb);
}

function listenForReplies() {
  imap.once("ready", function () {
    openInbox(function (err, box) {
      if (err) throw err;
      imap.on("mail", function () {
        fetchLatestEmail();
      });
    });
  });

  imap.connect();
}

function fetchLatestEmail() {
    const fetch = imap.seq.fetch("*", {
      bodies: "TEXT",
      struct: true,
    });
  
    fetch.on("message", function (msg, seqno) {
      msg.on("body", function (stream) {
        let buffer = "";
        stream.on("data", function (chunk) {
          buffer += chunk.toString("utf8");
        });
        stream.once("end", function () {
          console.log("Email received:", buffer);
          handleUserMessage(buffer);
        });
      });
    });
  
    fetch.once("end", function () {
      console.log("Done fetching latest email.");
      imap.end();
    });
  }
  
  function handleUserMessage(messageText) {
    // Instead of extracting the sender's email from msg.envelope, we assume it's already known
    const userEmail = "nikolajovanovski1993@gmail.com";  // Hardcoded for now or dynamically pass it based on context
  
    sendToAI(messageText, userEmail);
  }
  
  function sendToAI(messageText, userEmail) {
    axios
      .post("http://localhost:5000/ai-conversation", {
        email: userEmail,  // Pass the known user's email directly
        message: messageText,
      })
      .then((response) => {
        console.log("AI response:", response.data);
      })
      .catch((err) => {
        console.error("Error handling AI conversation:", err);
      });
  }
  



listenForReplies(); // Start the IMAP listener

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
