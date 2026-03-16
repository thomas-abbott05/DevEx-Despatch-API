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
            _id: apiKey
        });

        // Invalid API key 
        if (!keyRecord) {
            return res.status(401).json({
                errors: ["Invalid API key. Check it matches the one we issued you."],
                "executed-at": Math.floor(Date.now() / 1000),
            });
        }

        // Store the key itself so the routes can later access it easily.
        req.apiKey = apiKey;
        req.apiKeyOwner = keyRecord.owner;

        next();

    } catch (err) {
        console.error("API key Auth Error:", err);
        
        return res.status(500).json({
            errors: ["Internal server error - try again later."],
            "executed-at": Math.floor(Date.now() / 1000),
        });
    }
}

module.exports = apiKeyAuth;