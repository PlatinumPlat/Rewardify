import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command- Receive a hello world message.',
  type: 1,
  // integration_types: [0, 1],
  // contexts: [0, 1, 2],
};

const GIVEXP_COMMAND = {
  name: 'givexp',
  description: 'Send XP reward buttons for a user',

  type: 1,
  options: [
    {
      name: 'user',
      description: 'User to give XP to',
      type: 6,
      required: true
    },
  ],
};

const XP_COMMAND = {
  name: 'xp',
  description: 'Discover how much XP a user has.',
  type: 1,
  options: [
    {
      name: 'user',
      description: 'User to check XP for',
      type: 6,
      required: false
    },
  ],
};

const LEADERBOARD_COMMAND = {
  name: 'leaderboard',
  description: 'Show the top XP users',
  type: 1,
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  // integration_types: [0, 1],
  // contexts: [0, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, GIVEXP_COMMAND, XP_COMMAND, LEADERBOARD_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);

