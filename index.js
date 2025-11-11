const express = require('express');
const cors = require('cors');
require('dotenv').config()
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;


// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('studyMate server is available');
})


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
        await client.connect();

        const db = client.db('studyMate_db');
        const studentsCollection = db.collection('students')
        const newPartnerProfileCollection = db.collection('partners');
        const newRequestPartnerProfileCollection = db.collection('request_partner');

        // add database related apis here

        // Create Partner Profile api
        app.post('/partners', async (req, res) => {
            const newPartner = req.body;
            const result = await newPartnerProfileCollection.insertOne(newPartner);
            res.send(result);
            // same student check
            // const email = req.body.email;
            // const query = { email: email }
            // const existingStudent = await newPartnerProfileCollection.findOne(query);
            // if (existingStudent) {
            //     res.send({message : 'student already exist'})
            // }
            // else {
            //     const result = await newPartnerProfileCollection.insertOne(newPartner);
            //     res.send(result);
            // }
        })



        // Find Study Partners
        app.get('/students', async (req, res) => {

            // const email = req.query.email;

            const cursor = studentsCollection.find();
            const result = await cursor.toArray();
            res.send(result)
        })

        // GET single partner for PartnerDetails
        app.get('/students/:id', async (req, res) => {
            const id = req.params.id
            // console.log('need user with id' , id)
            // const result = await studentsCollection.findOne({ _id: new ObjectId(id) });
            // res.send(result);


            // const query = { _id: new ObjectId(id) }
            const query = { _id: id }
            const result = await studentsCollection.findOne(query);
            res.send(result)
        })

        // app.post('/students', async (req, res) => {
        //     // console.log('hitting the users post api')
        //     const newStudent = req.body;
        //     // console.log('user info', newStudent)
        //     const result = await studentsCollection.insertOne(newStudent);
        //     res.send(result);
        // })

        // PATCH partner count in partner details page and mongodb by press send partner request api
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
                console.error("Error incrementing partner count:", error);
                res.status(500).send({ error: "Internal server error" });
            }
            // const query = { _id: new ObjectId(id) }
            // const update = {
            //     $set: {
            //         name: updatedUser.name,
            //         email: updatedUser.email,
            //     }
            // }
            // const options = {}
            // const result = await studentsCollection.updateOne(query, update, options)
            // res.send(result)
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
                console.error("Error saving partner request:", error);
                res.status(500).send({ error: "Internal server error" });
            }
        });


        // Get all requests data from request_partner of a specific user 
        app.get("/request_partner", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send({ error: "Email query missing" });

            try {
                const result = await newRequestPartnerProfileCollection.find({ requesterEmail: email }).toArray();
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: "Failed to fetch partner requests" });
            }
        });


      

        // app.delete('/students/:id', async (req, res) => {
        //     // console.log(req.params.id)
        //     const id = req.params.id
        //     // console.log('delete users');
        //     const query = { _id: new ObjectId(id) }
        //     const result = await studentsCollection.deleteOne(query);
        //     res.send(result);
        // })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`studyMate server started on port: ${port}`)
})


// const users = [
//     { id: 1, name: 'rahim', email: 'rahim@yahoo.com' },
//     { id: 2, name: 'karim', email: 'karim@yahoo.com' },
//     { id: 3, name: 'roton', email: 'roton@yahoo.com' },
// ]

// app.get('/users', (req, res) => {
//     res.send(users);
// })
// app.post('/users', (req, res) => {
//     console.log('post method called', req.body);
//     const newUser = req.body;
//     newUser.id = users.length + 1;
//     users.push(newUser)
//     res.send(newUser);
// })

