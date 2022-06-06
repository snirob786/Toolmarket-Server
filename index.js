const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({
      message: "Unathorized Access",
    });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({
        message: "Forbidden Access",
      });
    }
    req.decoded = decoded;
    next();
  });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@toolmarket.nrwma.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const toolmarketToolsCollection = client
      .db("toolmarket")
      .collection("tools");
    const toolmarketReviewsCollection = client
      .db("toolmarket")
      .collection("reviews");
    const toolmarketUsersCollection = client
      .db("toolmarket")
      .collection("users");
    const toolmarketOrderCollection = client
      .db("toolmarket")
      .collection("orders");
    const toolmarketBlogsCollection = client
      .db("toolmarket")
      .collection("blogs");

    // Auth api
    app.post("/logintoken", async (req, res) => {
      const user = req.body;
      const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      res.send({ accessToken });
    });

    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolmarketToolsCollection.find(query);
      const tools = await cursor.toArray();
      res.send(tools);
    });

    app.get("/tool/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const tool = await toolmarketToolsCollection.findOne(query);
      res.send(tool);
    });

    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = toolmarketReviewsCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    app.get("/users/:uid", verifyJWT, async (req, res) => {
      const decodedUid = req.decoded.uid;
      const uid = req.params.uid;
      if (uid === decodedUid) {
        const query = {};
        const users = await toolmarketUsersCollection.find(query).toArray();
        res.send(users);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });

    app.get("/user/:uid", verifyJWT, async (req, res) => {
      const decodedUid = req.decoded.uid;
      const uid = req.params.uid;
      if (uid === decodedUid) {
        const query = { userId: uid };
        const userDetails = await toolmarketUsersCollection.findOne(query);
        res.send(userDetails);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });

    app.get("/myorders/:uid", verifyJWT, async (req, res) => {
      const decodedUid = req.decoded.uid;
      const uid = req.params.uid;
      if (uid === decodedUid) {
        const query = { buyerId: uid };
        const orderDetails = await toolmarketOrderCollection
          .find(query)
          .toArray();
        res.send(orderDetails);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });

    app.get("/allorders/:uid", verifyJWT, async (req, res) => {
      const decodedUid = req.decoded.uid;
      const uid = req.params.uid;
      if (uid === decodedUid) {
        const orderDetails = await toolmarketOrderCollection.find().toArray();
        res.send(orderDetails);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });

    app.get("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const orderDetails = await toolmarketOrderCollection.findOne(query);
      res.send(orderDetails);
    });

    app.get("/admin/:uid", verifyJWT, async (req, res) => {
      const decodedUid = req.decoded.uid;
      const uid = req.params.uid;
      if (uid === decodedUid) {
        const query = { userId: uid };
        const userDetails = await toolmarketUsersCollection.findOne(query);
        const isAdmin = userDetails.role === "admin";
        res.send(isAdmin);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });

    app.get("/blogs", async (req, res) => {
      const blogs = await toolmarketBlogsCollection.find().toArray();
      res.send(blogs);
    });

    // Update Api

    app.put("/user/:uid", async (req, res) => {
      const uid = req.params.uid;
      const user = req.body;
      const filter = { userId: uid };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await toolmarketUsersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign({ uid: uid }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      result["token"] = token;
      res.send(result);
    });

    app.put("/user/admin/:uid", async (req, res) => {
      const uid = req.params.uid;
      const filter = { userId: uid };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await toolmarketUsersCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    app.put("/tools", async (req, res) => {
      const productId = req.body.productId;
      const orderAmount = req.body.productAmount;
      const filter = { _id: ObjectId(productId) };
      const toolDetails = await toolmarketToolsCollection.findOne({
        _id: ObjectId(productId),
      });
      console.log(toolDetails.availableQuan);
      const updatedAvaialbelQuan = toolDetails.availableQuan - orderAmount;
      const updateDoc = {
        $set: { availableQuan: updatedAvaialbelQuan },
      };
      const result = await toolmarketToolsCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    // Patch API
    app.patch("/order/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: { paymentStatus: "paid", transactionId: payment.transactionId },
      };
      const result = await toolmarketOrderCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    app.patch("/shipping/:id", async (req, res) => {
      const id = req.params.id;
      const shipment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: { shipmentStatus: shipment.shipmentStatus },
      };
      const result = await toolmarketOrderCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    //Post Api
    app.post("/review", async (req, res) => {
      const newReview = req.body;
      const result = await toolmarketReviewsCollection.insertOne(newReview);
      res.send(result);
    });

    app.post("/order", async (req, res) => {
      const orderDetails = req.body;
      const result = await toolmarketOrderCollection.insertOne(orderDetails);
      res.send({ success: true, orderDetails: result });
    });

    app.post("/tool", async (req, res) => {
      const toolDetails = req.body;
      const result = await toolmarketToolsCollection.insertOne(toolDetails);
      res.send({ success: true, toolDetails: result });
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Delet Api
    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await toolmarketOrderCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/tool/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await toolmarketToolsCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello From Toolmarket");
});

app.listen(port, () => {
  console.log(`Toolmarket app listening on port ${port}`);
});
