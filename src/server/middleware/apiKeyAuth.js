const { getDb } = require('../database');

async function apiKeyAuth(req, res, next) {
    try {
        const apiKey = req.header("Api-Key");

        // If API key is missing
        if (!apiKey) {
            return res.status(401).json({
                errors: ["Missing API key header. A valid key is required for this endpoint."],
                "executed-at": Math.floor(Date.now() / 1000),
            });
        }

        const db = getDb();

        const keyRecord = await db.collection("api-keys").findOne({
            key: apiKey
        });

        // Invalid API key 
        if (!keyRecord) {
            return res.status(401).json({
                errors: ["Invalid API key"],
                "executed-at": Math.floor(Date.now() / 1000),
            });
        }

        req.apiKeyOwner = keyRecord.owner;

        next();

    } catch (err) {
        console.error("API key Auth Error:", err);
        
        return res.status(500).json({
            errors: ["Internal server error"],
            "executed-at": Math.floor(Date.now() / 1000),
        });
    }
}

module.exports = apiKeyAuth;


// This comments are for me 
// I will delete them later

// reads x-api-key
// checks MongoDB
// blocks request if invalid 