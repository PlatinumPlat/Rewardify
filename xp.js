import fs from 'fs';

const XP_FILE = './xpData.json';
const GLOBAL_XP_FILE = './globalXpData.json';
const ROLES_FILE = './roles.json';
const REVIEWS_FILE = './reviews.json';


export function getXPData() {
    if (!fs.existsSync(XP_FILE)) return {};
    return JSON.parse(fs.readFileSync(XP_FILE));
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
            console.log("doesn't exist");
        } if (!data[guildId][userId]) {
            data[guildId][userId] = 0;
            console.log("added user");
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

const cooldowns = {};

export function canReceiveXp(userId, guildId = 'global') {
    const key = `${guildId}_${userId}`;
    const now = Date.now();

    if (!cooldowns[key] || now - cooldowns[key] >= 15000) {
        cooldowns[key] = now;
        return true;
    }

    return false;
}


export function getXPLevel(xp) {
    return Math.floor(Math.sqrt(xp / 10));
}

export function getProgressBar(currentXP) {
    const currentLevel = getXPLevel(currentXP);
    const currentLevelXP = (currentLevel * currentLevel * 10);
    const nextLevelXP = (currentLevel + 1) * (currentLevel + 1) * 10;

    const progress = currentXP - currentLevelXP;
    const total = nextLevelXP - currentLevelXP;
    const percent = progress / total;

    const filledBars = Math.round(percent * 10);
    const emptyBars = 10 - filledBars;

    return '🟩'.repeat(filledBars) + '⬛'.repeat(emptyBars) + ` (${progress}/${total})`;
}

export function getLevelId(level, guildId) {
    const roles = JSON.parse(fs.readFileSync(ROLES_FILE));

    if (!roles[guildId] || !roles[guildId].roles) {
        return null;
    }

    const levelMap = roles[guildId].roles;

    const thresholds = Object.keys(levelMap)
        .map(Number)
        .sort((a, b) => b - a);

    for (const threshold of thresholds) {
        if (level >= threshold) {
            return levelMap[threshold];
        }
    }

    return null;
}

export function setUpRoles(rolemap, guildId) {
    let roleData = {};

    if (fs.existsSync(ROLES_FILE)) {
        roleData = JSON.parse(fs.readFileSync(ROLES_FILE));
    }

    if (!roleData[guildId]) {
        roleData[guildId] = {};
    }

    roleData[guildId] = {
        roles: rolemap
    };

    fs.writeFileSync(ROLES_FILE, JSON.stringify(roleData, null, 2));
}

export function preparedRolesOrNot(guildId) {
    let roleData = {};

    if (fs.existsSync(ROLES_FILE)) {
        roleData = JSON.parse(fs.readFileSync(ROLES_FILE));
    } 
    
    return roleData[guildId];
}

export function loadReviews() {
    if (!fs.existsSync(REVIEWS_FILE)) fs.writeFileSync(REVIEWS_FILE, '{}');
    return JSON.parse(fs.readFileSync(REVIEWS_FILE));
}

export function saveReviews(data) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(data, null, 2));
}

export function addReview(guildId, userId, review) {
    const data = loadReviews();

    if (!data[guildId]) {
        data[guildId] = {};
    }

    if (!data[guildId][userId]) {
        data[guildId][userId] = [];
    }

    data[guildId][userId].push(review);
    saveReviews(data);
}

export function getReviews(guildId, userId) {
    const data = loadReviews();
    return data[guildId]?.[userId] || [];
}