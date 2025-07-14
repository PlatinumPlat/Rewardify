import fs from 'fs';

const XP_FILE = './xpData.json';
const GLOBAL_XP_FILE = './globalXpData.json';

export function getXPData(guildId) {
    if (!fs.existsSync(XP_FILE)) return {};
    const data = JSON.parse(fs.readFileSync(XP_FILE));
    return data[guildId] || {};
}

export function getGlobalXPData() {
    if (!fs.existsSync(GLOBAL_XP_FILE)) return {};
    return JSON.parse(fs.readFileSync(GLOBAL_XP_FILE));
}

export function saveXPData(data) {
    fs.writeFileSync(XP_FILE, JSON.stringify(data, null, 2));
}

export function saveGlobalXPData(data) {
    fs.writeFileSync(GLOBAL_XP_FILE, JSON.stringify(data, null, 2));
}

export function addXP(userId, amount, guildId = 'global') {
    if (guildId != 'global') {
        const data = getXPData();

        if (!data[guildId]) {
            data[guildId] = {};
        } if (!data[guildId][userId]) {
            data[guildId][userId] = 0;
        }

        data[guildId][userId] += amount;
        saveXPData(data);

        return data[guildId][userId];
    } else {
        const data2 = getGlobalXPData();
        if (!data2[userId]) {
            data2[userId] = 0;
        }

        data2[userId] += amount;
        saveGlobalXPData(data2);

        return data2[userId];
    }
}

export function getUserXP(userId, guildId = 'global') {

    if (guildId === 'global') {
        const data2 = getGlobalXPData();
        return data2[userId] || 0;
    } else {
        const data = getXPData();
        return data[guildId]?.[userId] || 0;
    }
}