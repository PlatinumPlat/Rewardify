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
import { addXP, getUserXP, getXPData, getGlobalXPData, canReceiveXp, getProgressBar, getXPLevel, getLevelId, setUpRoles, preparedRolesOrNot, getReviews, addReview } from './xp.js';
import { formatRelative } from 'date-fns';


const app = express();
const PORT = process.env.PORT || 3000;

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { type, id, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
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

      const guildId = req.body.guild_id || 'global';
      console.log(guildId);
      const xp = getUserXP(targetUserId, guildId);
      const Globalxp = getUserXP(targetUserId, 'global');

      const level = getXPLevel(xp);
      const GlobalLevel = getXPLevel(Globalxp);

      const progressBar = getProgressBar(xp);
      const globalProgressBar = getProgressBar(Globalxp);


      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: '📊 XP Summary',
              color: 0x00ffcc,
              description: `<@${targetUserId}> has **${xp} XP** in this server!\n<@${targetUserId}> has **${Globalxp} XP** in total!\n` + `📈 **Level Stats**\n<@${targetUserId}> is at Level ${level} in this server!\n` + `${progressBar}\n\n` + `At a global scale, <@${targetUserId}> is at Level ${GlobalLevel}!\n` + `${globalProgressBar}`,
              footer: {
                text: 'Continue being helpful to earn more!'
              }
            }
          ]

        }
      });
    }

    if (name === 'leaderboard') {
      const guildId = req.body.guild_id || 'global'
      console.log(guildId);
      const xpData = getXPData(guildId)[guildId];

      const sorted = Object.entries(xpData).sort(([, a], [, b]) => b - a).slice(0, 10);

      const leaderboardText = sorted.map(
        ([userId, xp], i) => `**${i + 1}.** <@${userId}> - ${xp}XP`).join('\n');

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
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

    if (name === 'prepare-roles-help') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: '🛠️ Role Preparation Guide',
              color: 0x00b0f4,
              description: `Follow the steps below to allow Rewardify to assign roles to members for xp achievements!\n1. Create a role for Level 1 (Rewardify); you can name your role whatever you would like (you can even include short catchphrases to your liking), as long as it has the key words, "Level 1," and "Rewardify." Repeat this six times, each time increasing the level amount, until the last level is called, Level 6+ (Rewardify). In the roles table, make sure you drag the roles in the correct order so that level amounts are in a decreasing order.\n2. Scroll down in the role creation page, and (optionally but recommended) assign each role a different colour.\n3., scroll down even more and select the checkbox corresponding to "Display role members separately from other online members."\n4. Go to your user settings > App Settings > Advanced and enable Developer Mode.\n5. In the role table, on the right side, click "Copy Role Id" and save them (don't mess up the order!).\n6. Once you're done all the previous steps, use the command, /prepare-roles to submit the role ids.`,
              footer: {
                text: 'Rewardify Role Setup'
              }
            }
          ]
        }
      });
    }

    if (name === 'prepare-roles') {
      const guildId = req.body.guild_id;
      const roleMap = {
        1: data.options.find(o => o.name === 'level1')?.value,
        2: data.options.find(o => o.name === 'level2')?.value,
        3: data.options.find(o => o.name === 'level3')?.value,
        4: data.options.find(o => o.name === 'level4')?.value,
        5: data.options.find(o => o.name === 'level5')?.value,
        6: data.options.find(o => o.name === 'level6plus')?.value,
      };

      setUpRoles(roleMap, guildId);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: '✅ Roles Preparation SUCCESSFUL!',
              description: 'Role assignment is now enabled for all participants!',
              color: 0x4caf50,
              footer: {
                text: 'yay!'
              }
            }
          ]
        }
      });
    }

    if (name === 'review') {
      const guildId = req.body.guild_id;
      const reviewerId = req.body.member.user.id;
      const revieweeId = data.options.find(o => o.name === 'user')?.value || '';
      const message = data.options.find(o => o.name === 'message')?.value || '';
      const timestamp = Date.now();

      if (reviewerId == revieweeId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: '❌ Self evalluation is not permitted!',
                description: 'You cannot review yourself.',
                footer: {
                  text: 'Rewardify is watching...'
                }
              }
            ]
          }
        });
      }

      addReview(guildId, revieweeId, {
        from: reviewerId,
        message,
        timestamp
      });

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: '✅ Review SUCCESSFUL!',
              description: `<@${revieweeId}> just received a review from <@${reviewerId}>!`,
              footer: {
                text: `Thank you for making a contribution!`
              }
            }
          ]
        }
      });
    }

    if (name === 'viewreviews') {
      const user = data.options.find(opt => opt.name === 'user')?.value;
      const guildId = req.body.guild_id;
      const reviews = getReviews(guildId, user);

      return res.send({
        type: 4,
        data: {
          embeds: [
            {
              title: `Reviews for <@${user}>`,
              fields: reviews.slice(-5).reverse().map(r => ({
                name: `Review From <@${r.from}>`,
                value: `${r.message ? r.message : '_Empty_Review_'}\n*${formatRelative(r.timestamp, Date.now())}*`
              }))
            }
          ],
        }
      }); 
    }

    if (name === 'myreviews') {
      const user = req.body.member.user.id;
      const guildId = req.body.guild_id;
      const reviews = getReviews(guildId, user);

      const fields = reviews.slice(-5).reverse().map(r => ({
        name: `Review From <@${r.from}>`,
        value: `${r.message} || '_Empty_Review_'}\n*${formatRelative(r.timestamp, Date.now())}*`
      }));

      const content = fields.length ? { title: `Your Reviews`, fields } : { description: 'No reviews provided' };

      return res.send({
        type: 4,
        data: {
          embeds: [content]
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
      const guildId = req.body.guild_id || 'global';
      console.log(guildId);

      if (!canReceiveXp(targetUserId, guildId)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: '⏳ Cooldown Active',
                color: 0xff0000,
                description: `You must wait before giving XP to <@${targetUserId}>. (This rule was enforced to prevent users from spamming the xp system with requests)`,
                footer: {
                  text: 'Please do not abuse this xp system!'
                }
              }
            ]
          }
        });
      }

      const newTotal = addXP(targetUserId, xp, guildId);
      let globalTotal = newTotal;
      if (guildId !== 'global') {
        globalTotal = addXP(targetUserId, xp, 'global');
      }

      if (preparedRolesOrNot(guildId)) {
        let booleanRole = false;
        if (getXPLevel(newTotal) > getXPLevel(newTotal - xp)) {
          const roleId = getLevelId(getXPLevel(newTotal), guildId);
          const endpoint = `/guilds/${guildId}/members/${targetUserId}/roles/${roleId}`;
          try {
            await DiscordRequest(endpoint, {
              method: 'PUT',
              headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`
              }
            });
            console.log(`✅ Gave role ${roleId} to user ${targetUserId}`);
            booleanRole = true;
          } catch (err) {
            console.error('❌ Failed to assign role:', err);
          }
        } else {
          console.log(getXPLevel(newTotal - xp), getXPLevel(newTotal));
        }

        if (booleanRole) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              embeds: [
                {
                  title: '💳 Transaction Summary',
                  color: 0x006853,
                  description: `✅ Transaction SUCCESSFUL!\n<@${targetUserId}> now has a total of **${newTotal} XP** in this server and **${globalTotal} XP** in total!\nRole Assignment was SUCCESSFUL; check out <@${targetUserId}>'s new role (click their profile)!`,
                  footer: {
                    text: 'Thank you for helping elevate discord!'
                  }
                }
              ]
            }
          });
        } else {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              embeds: [
                {
                  title: '💳 Transaction Summary',
                  color: 0x006853,
                  description: `✅ Transaction SUCCESSFUL!\n<@${targetUserId}> now has a total of **${newTotal} XP** in this server and **${globalTotal} XP** in total!`,
                  footer: {
                    text: 'Thank you for helping elevate discord!'
                  }
                }
              ]
            }
          });
        }
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: '💳 Transaction Summary',
                color: 0x006853,
                description: `✅ Transaction SUCCESSFUL!\n<@${targetUserId}> now has a total of **${newTotal} XP** in this server and **${globalTotal} XP** in total!\nRole Assignment was ❌UNSUCCESSFUL, please follow the instructions provided by /prepare-roles-help to complete /prepare-roles.`,
                footer: {
                  text: 'Thank you for helping elevate discord!'
                }
              }
            ]
          }
        });
      }
    }
    return;
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
