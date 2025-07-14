import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { addXP, getUserXP, getXPData, getGlobalXPData} from './xp.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // "challenge" command
    if (name === 'challenge' && id) {
      // Interaction context
      const context = req.body.context;
      // User ID is in user field for (G)DMs, and member for servers
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
      // User's object choice
      const objectName = req.body.data.options[0].value;

      // Create active game using message ID as the game ID
      activeGames[id] = {
        id: userId,
        objectName,
      };

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `Rock papers scissors challenge from <@${userId}>`,
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  // Append the game ID to use later on
                  custom_id: `accept_button_${req.body.id}`,
                  label: 'Accept',
                  style: ButtonStyleTypes.PRIMARY,
                },
              ],
            },
          ],
        },
      });
    }

    if (name == 'givexp') {
      const targetUser = data.options[0].value;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `Give XP to <@${targetUser}>`,
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  label: '+10 XP',
                  style: ButtonStyleTypes.PRIMARY,
                  custom_id: `reward:10:${targetUser}`
                },
                {
                  type: MessageComponentTypes.BUTTON,
                  label: '+5 XP',
                  style: ButtonStyleTypes.SUCCESS,
                  custom_id: `reward:5:${targetUser}`
                },
                {
                  type: MessageComponentTypes.BUTTON,
                  label: '-5 XP',
                  style: ButtonStyleTypes.DANGER,
                  custom_id: `reward:-5:${targetUser}`
                },
                {
                  type: MessageComponentTypes.BUTTON,
                  label: '-10 XP',
                  style: ButtonStyleTypes.DANGER,
                  custom_id: `reward:-10:${targetUser}`
                }
              ]
            }
          ]
        }
      });
    }

    if (name == 'xp') {
      const context = req.body.context;
      const targetUserId = req.body.data.options?.[0]?.value || (context === 0 ? req.body.member.user.id : req.body.user.id);

      const guildId = req.body.guildId || 'global';
      const xp = getUserXP(targetUserId, guildId);
      const Globalxp = getUserXP(targetUserId, 'global');

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // components: [
          //   {
          //     type: MessageComponentTypes.TEXT_DISPLAY,
          //     context: `✅ Request SUCCESSFUL!\n <@${targetUserId}> has a total of **${xp} XP**!`
          //   }
          // ]
          embeds: [
            {
              title: '📊 XP Summary',
              color: 0x00ffcc,
              description: `<@${targetUserId}> has **${xp} XP** in this server!.\n<@${targetUserId}> has **${Globalxp} XP** in total!`,
              footer: {
                text: 'Continue being helpful to earn more!'
              }
            }
          ]

        }
      });
    }

    if (name === 'leaderboard') {
      const guildId = req.body.guildId || 'global'
      const xpData = getXPData(guildId)
      
      const sorted = Object.entries(xpData).sort(([, a], [, b]) => b-a).slice(0, 10);

      const leaderboardText = sorted.map(
        ([userId, xp], i) =>  `**${i+1}.** <@${userId}> - ${xp}XP`).join('\n');

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // components: [
          //   {
          //     type: MessageComponentTypes.TEXT_DISPLAY,
          //     content: leaderboardText || `No users with XP yet.`
          //   }
          // ]
          embeds: [
            {
              title: '🏆 XP Leaderboard',
              color: 0xffcc00,
              description: leaderboardText || '_No users have XP yet._',
              footer: {
                text: 'Top 10 members in this server!'
              }
            }
          ]
        }
      });
    }

    if (name === 'globalleaderboard') {
      const xpData = getGlobalXPData()

      const sorted = Object.entries(xpData).sort(([, a], [, b]) => b - a).slice(0, 15);

      const leaderboardText = sorted.map(
        ([userId, xp], i) => `**${i + 1}.** <@${userId}> - ${xp}XP`).join('\n');

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // components: [
          //   {
          //     type: MessageComponentTypes.TEXT_DISPLAY,
          //     content: leaderboardText || `No users with XP yet.`
          //   }
          // ]
          embeds: [
            {
              title: '🏆 XP Leaderboard',
              color: 0xffcc00,
              description: leaderboardText || '_No users have XP yet._',
              footer: {
                text: 'Top 15 members worldwide!'
              }
            }
          ]
        }
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  /**
   * Handle requests from interactive components
   * See https://discord.com/developers/docs/components/using-message-components#using-message-components-with-interactions
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;

    if (componentId.startsWith('accept_button_')) {
      // get the associated game ID
      const gameId = componentId.replace('accept_button_', '');
      // Delete message with token in request body
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      try {
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Indicates it'll be an ephemeral message
            flags: InteractionResponseFlags.EPHEMERAL | InteractionResponseFlags.IS_COMPONENTS_V2,
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: 'What is your object of choice?',
              },
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.STRING_SELECT,
                    // Append game ID
                    custom_id: `select_choice_${gameId}`,
                    options: getShuffledOptions(),
                  },
                ],
              },
            ],
          },
        });
        // Delete previous message
        await DiscordRequest(endpoint, { method: 'DELETE' });
      } catch (err) {
        console.error('Error sending message:', err);
      }
    } else if (componentId.startsWith('select_choice_')) {
      // get the associated game ID
      const gameId = componentId.replace('select_choice_', '');

      if (activeGames[gameId]) {
        // Interaction context
        const context = req.body.context;
        // Get user ID and object choice for responding user
        // User ID is in user field for (G)DMs, and member for servers
        const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
        const objectName = data.values[0];
        // Calculate result from helper function
        const resultStr = getResult(activeGames[gameId], {
          id: userId,
          objectName,
        });

        // Remove game from storage
        delete activeGames[gameId];
        // Update message with token in request body
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

        try {
          // Send results
          await res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.IS_COMPONENTS_V2,
              components: [
                {
                  type: MessageComponentTypes.TEXT_DISPLAY,
                  content: resultStr
                }
              ]
            },
          });
          // Update ephemeral message
          await DiscordRequest(endpoint, {
            method: 'PATCH',
            body: {
              components: [
                {
                  type: MessageComponentTypes.TEXT_DISPLAY,
                  content: 'Nice choice ' + getRandomEmoji()
                }
              ],
            },
          });
        } catch (err) {
          console.error('Error sending message:', err);
        }
      }
    } else if (componentId.startsWith('reward:')) {
      const [_prefix, amount, targetUserId] = componentId.split(':');
      const xp = parseInt(amount);
      const guildId = req.body.guild_Id || 'global'; //Make sure this works.
      
      const newTotal = addXP(targetUserId, xp, guildId);
      const globalTotal = newTotal;
      if (guildId !== 'global') {
        globalTotal = addXP(targetUserId, xp, 'global');
      }

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: '💳 Transaction Summary',
              color: 0x006853,
              description: `✅ Transaction SUCCESSFUL!\n<@${targetUserId}> now has a total of **${newTotal} XP** in this server and **${globalTotal} XP** in total!`,
              footer: {
                text: 'Amazing work!'
              }
            }
          ]
        }
      });
    }

    return;
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
