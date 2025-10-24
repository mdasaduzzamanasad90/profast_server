const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.tobpnew.mongodb.net/?appName=Cluster0`;

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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const dataBaseParcels = client.db("profast").collection("parcels");

    await dataBaseParcels.createIndex({ trackingId: 1 }, { unique: true });

    app.get("/parcels", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        // সব parcels ডাটাবেজ থেকে নিয়ে আসা
        const result = await dataBaseParcels
          .find(query)
          .sort({ createdDate: -1 })
          .toArray();

        // সফল রেসপন্স পাঠানো
        res.status(200).send({
          success: true,
          message: "Parcels fetched successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error fetching parcels:", error);

        // Error রেসপন্স পাঠানো
        res.status(500).send({
          success: false,
          message: "Failed to fetch parcels",
          error: error.message,
        });
      }
    });

    app.post("/parcels", async (req, res) => {
      try {
        const clientData = req.body;

        const parcelData = {
          ...clientData,
          trackingId:
            "TRK-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
          createdDate: new Date().toISOString(), // ✅ ISO 8601 ফরম্যাট
          paymentStatus: "unpaid",
          parcelStatus: "pending",
        };

        // ডাটাবেজে ইনসার্ট করা
        const result = await dataBaseParcels.insertOne(parcelData);

        // সফল হলে রেসপন্স পাঠানো
        res.status(201).send({
          success: true,
          message: "Parcel added successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error inserting parcel:", error);

        // যদি কোনো ভুল হয়, তা ধরার জন্য proper error response
        res.status(500).send({
          success: false,
          message: "Failed to add parcel",
          error: error.message,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is Running on port ${port}`);
});
