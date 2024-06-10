const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const stripe = require("stripe")(process.env.SECREET_KEY);
const port = process.env.PORT || 5000;

//------ middlewere ----
const corsOptions = {
  origin: ["http://localhost:5173", 'http://localhost:5174', 'https://talentiq-2af8f.web.app'],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const tokeen = req.cookies?.tokeen;
  // console.log(token);
  if (!tokeen) {
    return res.status(401).send({ message: "unauthorized access1" });
  }
  jwt.verify(tokeen, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access2" });
    }
    req.user = decoded;
    next();
  });
};

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
    const workSheetCollection = client.db("TalentIQ").collection("worksheet");
    const messageCollection = client.db("TalentIQ").collection("message");
    const salaryPaidCollection = client.db("TalentIQ").collection("paid");
    const testimonialsCollection = client.db("TalentIQ").collection("testimonials");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("tokeen", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // verify admin meddlewere
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);

      if (!result || result?.role !== "Admin") {
        return res.status(401).send({ message: "unauthorize access" });
      }
      next();
    };

    // verify host meddlewere
    const verifyHR = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);

      if (!result || result?.role !== "HR") {
        return res.status(401).send({ message: "unauthorize access" });
      }
      next();
    };

    // create-pament -intent
    app.post("/create-payment-intent", verifyToken, verifyHR, async (req, res) => {
      const salary = req.body.salary;
      const salaryInCent = parseFloat(salary) * 100;
      if (!salary || salaryInCent < 1) return;
      // genarate client secret
      const { client_secret } = await stripe.paymentIntents.create({
        amount: salaryInCent,
        currency: "usd",
        // # In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });
      //send client secret as response
      res.send({ clientSecret: client_secret });
    });

    // save paid salary employee data in db
    app.post("/paid", verifyToken, async (req, res) => {
      const employeeData = req.body;
      // console.log(employeeData)
      const result = await salaryPaidCollection.insertOne(employeeData);
      res.send(result);
    });

    // get a employee paid salary data by email in db
    app.get("/paid/:email", verifyToken,  async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const result = await salaryPaidCollection.find({ email }).toArray();
      res.send(result);
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("tokeen", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // save a employee in db
    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      // check user already exist
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if(user?.role === 'HR'){
          const result = await usersCollection.updateOne(query, {$set: {role: 'HR'}})
          return res.send(result)
        } else{
          return res.send(isExist)
        }
        // return res.send(isExist);
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
    app.get("/users", verifyToken,  async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get a employee info by email in db
    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // get single data by id from bd
    app.get("/users/:id", verifyToken, verifyHR, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // update verified status in db
    app.patch("/user/:email", verifyToken, verifyHR, async (req, res) => {
      const email = req.params.email;
      const verified = req.body;
      // console.log(verified);
      const query = { email: email };
      const updateDoc = {
        $set: verified,
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // save work sheet in db
    app.post("/work", verifyToken, async (req, res) => {
      const workSheet = req.body;
      const result = await workSheetCollection.insertOne(workSheet);
      res.send(result);
    });

    // get all employee work record from db
    app.get("/works", async (req, res) => {
      const result = await workSheetCollection.find().toArray();
      res.send(result);
    });

    // get my work sheet data by email
    app.get("/mywork/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      let query = { email: email };
      const result = await workSheetCollection.find(query).toArray();
      res.send(result);
    });

    // save message in db
    app.post("/message", async (req, res) => {
      const data = req.body;
      const result = await messageCollection.insertOne(data);
      res.send(result);
    });

    // get testimonials data from db
    app.get("/testimonial",  async (req, res) => {
      const result = await testimonialsCollection.find().toArray();
      res.send(result);
    });

    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
