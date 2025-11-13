const express = require('express');
const cors = require('cors');
require('dotenv').config()
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

//index.js
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('studyMate server is available');
})

const verifyFireBaseToken = async (req, res, next) => {
    // console.log('in the verify middleware', req.headers.authorization)
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1]
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.token_email = decoded.email;
        // console.log('after decode token validation', decoded)
        next();
    }
    catch (error) {
        // console.log('invalid token')
        return res.status(401).send({ message: 'unauthorized access' })
    }
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.y6dazfp.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // await client.connect();

        const db = client.db('studyMate_db');
        const studentsCollection = db.collection('students')
        const newPartnerProfileCollection = db.collection('partners');
        const newRequestPartnerProfileCollection = db.collection('request_partner');

        // add database related apis here

        // Create Partner Profile api
        app.post('/partners', verifyFireBaseToken, async (req, res) => {
            // console.log('headers in the post', req.headers);
            const newPartner = req.body;
            const result = await newPartnerProfileCollection.insertOne(newPartner);
            res.send(result);
            
        })




        // Find Study Partners with Search (Subject, Name, Location) and Sort (Experience, Rating, Name)
        app.get('/students', async (req, res) => {
            try {
                const search = req.query.search || ""; // e.g. ?search=math
                const sortOption = req.query.sort || ""; // e.g. ?sort=experience
                // console.log('server receive', search, sortOption);

                const query = {};

                
                //  If search text exists, match against name, subject, or location
                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: "i" } },
                        { subject: { $regex: search, $options: "i" } },
                        { location: { $regex: search, $options: "i" } }
                    ];
                }

                //  Sort setup
                let sort = {};
                if (sortOption === "rating") {
                    sort = { rating: -1 }; // High to Low
                } else if (sortOption === "name") {
                    sort = { name: 1 }; // A → Z
                }

                //  Special manual sort for Experience Level
                if (sortOption === "experience") {
                    const data = await studentsCollection.find(query).toArray();
                    const order = { Beginner: 1, Intermediate: 2, Advanced: 3 };
                    data.sort((a, b) => order[a.experienceLevel] - order[b.experienceLevel]);
                    return res.send(data);
                }

                //  Otherwise, regular query with optional sort
                const result = await studentsCollection.find(query).sort(sort).toArray();
                res.send(result);
            } catch (error) {
                // console.error("Error fetching students:", error);
                res.status(500).send({ error: "Failed to fetch students" });
            }
        });



        // Get Top Study Partners (highest rating first)
        app.get('/topstudy-partners', async (req, res) => {
            try {
                // Fetch top-rated study partners, sort descending by rating, limit 3
                const topPartners = await studentsCollection
                    .find({})
                    .sort({ rating: -1 })
                    .limit(3)
                    .toArray();

                res.send(topPartners);
            }
            catch (error) {
                // console.error("Error fetching top study partners:", error);
                res.status(500).send({ error: "Failed to fetch top partners" });
            }
        });


        // verifyFireBaseToken
        // GET single partner for PartnerDetails by press View Profile button
        app.get('/students/:id', verifyFireBaseToken, async (req, res) => {
            const id = req.params.id
            const query = { _id: id }
            const result = await studentsCollection.findOne(query);
            res.send(result)
        })



        // PATCH partner count in PartnerDetails page and mongodb by press send partner request api
        app.patch("/students/:id", async (req, res) => {
            const id = req.params.id;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ error: "Invalid partner ID" });
            }

            try {
                const result = await studentsCollection.updateOne(
                    { _id: id },
                    { $inc: { partnerCount: 1 } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: "Partner not found" });
                }

                res.send({ success: true, message: "Partner count incremented" });
            } catch (error) {
                // console.error("Error incrementing partner count:", error);
                res.status(500).send({ error: "Internal server error" });
            }

        })


        // POST — Create(send) Partner Request details in another db called request_partner with login user name and email

        app.post("/request_partner", async (req, res) => {
            const requestData = req.body;

            if (!requestData.partnerId || !requestData.requesterEmail) {
                return res.status(400).send({ error: "Missing required fields" });
            }

            try {
                const result = await newRequestPartnerProfileCollection.insertOne(requestData);
                res.send({ success: true, message: "Partner request saved", result });
            } catch (error) {
                // console.error("Error saving partner request:", error);
                res.status(500).send({ error: "Internal server error" });
            }
        });

        // verifyFireBaseToken
        // Get all requests data from request_partner of a specific user 
        // My Connections
        app.get("/request_partner", verifyFireBaseToken, async (req, res) => {
            // console.log('headers', req.headers)
            // console.log('headers', req)
            const email = req.query.email;
            if (!email) return res.status(400).send({ error: "Email query missing" });

            if (email !== req.token_email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            try {
                const result = await newRequestPartnerProfileCollection.find({ requesterEmail: email }).toArray();
                res.send(result);
            }
            catch (error) {
                // console.error(error);
                res.status(500).send({ error: "Failed to fetch partner requests" });
            }
        });

        // My Connections
        // Delete a request from db request_partner
        app.delete("/request_partner/:id", async (req, res) => {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) return res.status(400).send({ error: "Invalid ID" });

            try {
                const result = await newRequestPartnerProfileCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 0)
                    return res.status(404).send({ error: "Request not found" });

                res.send({ success: true, message: "Request deleted" });
            } catch (error) {
                // console.error(error);
                res.status(500).send({ error: "Internal Server Error" });
            }
        });

        // My Connections
        //  Update a request from request_partner
        app.patch("/request_partner/:id", async (req, res) => {
            const id = req.params.id;
            const updateData = req.body;
            if (!ObjectId.isValid(id)) return res.status(400).send({ error: "Invalid ID" });

            try {
                const result = await newRequestPartnerProfileCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                if (result.modifiedCount === 0)
                    return res.status(404).send({ error: "No document updated" });

                res.send({ success: true, message: "Request updated successfully" });
            } catch (error) {
                // console.error(error);
                res.status(500).send({ error: "Failed to update request" });
            }
        });



        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`studyMate server started on port: ${port}`)
})




