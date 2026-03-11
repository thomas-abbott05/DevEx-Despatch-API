const { getDb } = require('../dataBase');

async function apiKeyAuth(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({
                error: 'API key missing'
            });
        }

        const db = getDb();

        const key = await db.collection('api_keys').findOne({
            active: true
        });
        if (!key) {
            return res.status(403).json({
                error: 'Invalid API key'
            });
        }

        req.team = key.teamName;

        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Authetication error'
        });
    }
}

module.exports = apiKeyAuth;


// This comments are for me 
// I will delete them later

// reads x-api-key
// checks MongoDB
// blocks request if invalid 