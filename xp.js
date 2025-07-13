import fs from 'fs';

const XP_FILE = './xpData.json';

export function getXPData() {
    if (!fs.existsSync(XP_FILE)) return {};
    return JSON.parse(fs.readFileSync(XP_FILE));
}

export function saveXPData(data) {
    fs.writeFileSync(XP_FILE, JSON.stringify(data, null, 2));
}

export function addXP(userId, amount) {
    const data = getXPData();
    if (!data[userId]) {
        data[userId] = 0;
    }

    data[userId] += amount;
    saveXPData(data);
    return data[userId];
}

export function getUserXP(userId) {
    const data = getXPData();
    return data[userId] || 0;
}