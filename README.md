This project implements a system that facilitates a conversation between a user and an AI entirely via email. The system is designed to promote the Sarah Academy product and is built using Node.js, Express, and Nodemailer, with AI responses generated using Cohere API.

Features

Simple web page where users can enter their email address.

Sends an invitation email to the user to start a conversation.

Conducts AI conversations entirely via email.

Promotes the Sarah Academy product throughout the conversation.

Utilizes IMAP to listen for user replies and handles threading.

Prerequisites

Node.js installed on your machine.

A Gmail account for sending emails.

API keys for the following services:

Cohere

(Optional) Hugging Face if used in extensions.

A Heroku account if deploying the app.

Installation


Install dependencies:

npm install

Create a .env file in the project root and configure it with the following variables:

EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
COHERE_API_KEY=your-cohere-api-key
PORT=5000

Verify the lockfile:

If using npm, ensure only package-lock.json exists:


Running Locally

Start the server:

npm start

or for this case node server.js

The app will run on http://localhost:5000.