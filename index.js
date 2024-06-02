const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

//------ middlewere ----
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ot34xl4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("TalentIQ").collection("user");

    // save a employee in db
    app.put("/user", async (req, res) => {
      const user = req.body;
      // console.log(user)
      const query = { email: user?.email };
      // check user already exist
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        // if(user.status === 'request'){
        //   const result = await usersCollection.updateOne(query, {$set: {status: user?.status}})
        //   return res.send(result)
        // } else{
        //   return res.send(isExist)
        // }
        return res.send(isExist);
      }
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, option);
      res.send(result);
    });

    // get all employee from db
    app.get('/user', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // get a employee info by email in db
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email; 
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });



    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("employee management server calling.");
});

app.listen(port, () => {
  console.log(`Employee server running on port ${port}`);
});
