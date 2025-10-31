const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// ===== Middlewares =====
app.use(cors());
app.use(express.json());

// ===== MongoDB Connection URI =====
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.tobpnew.mongodb.net/?appName=Cluster0`;

// ===== MongoClient Configuration =====
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ====== Main Function ======
async function run() {
  try {
    await client.connect();

    const dataBaseParcels = client.db("profast").collection("parcels");

    // Create index for trackingId
    await dataBaseParcels.createIndex({ trackingId: 1 }, { unique: true });

    // ====== GET: All Parcels (optional email filter) ======
    app.get("/parcels", async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};

        if (email) {
          query = { email: email };
        }

        const result = await dataBaseParcels
          .find(query)
          .sort({ createdDate: -1 })
          .toArray();

        res.status(200).send({
          success: true,
          message: "Parcels fetched successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error fetching parcels:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch parcels",
          error: error.message,
        });
      }
    });

    // ====== POST: Add New Parcel ======
    app.post("/parcels", async (req, res) => {
      try {
        const clientData = req.body;

        const parcelData = {
          ...clientData,
          trackingId:
            "TRK-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
          createdDate: new Date().toISOString(),
          paymentStatus: "unpaid",
          parcelStatus: "pending",
        };

        const result = await dataBaseParcels.insertOne(parcelData);

        res.status(201).send({
          success: true,
          message: "Parcel added successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error inserting parcel:", error);
        res.status(500).send({
          success: false,
          message: "Failed to add parcel",
          error: error.message,
        });
      }
    });

    // ====== DELETE: Parcel by ID ======
    app.delete("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await dataBaseParcels.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Parcel not found or already deleted",
          });
        }

        res.status(200).send({
          success: true,
          message: "Parcel deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting parcel:", error);
        res.status(500).send({
          success: false,
          message: "Failed to delete parcel",
          error: error.message,
        });
      }
    });

    // ====== GET: Single Parcel by ID ======
    app.get("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await dataBaseParcels.findOne(query);

        if (!result) {
          return res.status(404).send({
            success: false,
            message: "Parcel not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Parcel fetched successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error fetching parcel by ID:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch parcel by ID",
          error: error.message,
        });
      }
    });

    // ====== MongoDB Ping Check ======
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB successfully!");
  } finally {
    // await client.close(); // optional
  }
}

run().catch(console.dir);

// ====== Root Route ======
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// ====== Start Server ======
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
