const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { default: Stripe } = require("stripe");

const app = express();
const port = process.env.PORT || 3000;

// ===== Middlewares =====
app.use(cors());
app.use(express.json());
const stripe = new Stripe(process.env.SECRET_KEY);

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
    const dataBase = client.db("profast");
    const dataBaseParcels = dataBase.collection("parcels");
    const dataBasePayments = dataBase.collection("payments");
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

    // Payment system
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { coinamount } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: coinamount,
          currency: "bdt",
          payment_method_types: ["card"],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Update Parcel Payment Status by _id
    app.patch("/parcels/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { paymentStatus } = req.body;

        if (!id || !paymentStatus) {
          return res
            .status(400)
            .json({ success: false, message: "ID and paymentStatus required" });
        }

        const result = await dataBaseParcels.updateOne(
          { _id: new ObjectId(id) }, // _id দিয়ে document চিহ্নিত করা
          { $set: { paymentStatus } } // শুধু paymentStatus আপডেট হবে
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Parcel not found",
          });
        }

        res.json({
          success: true,
          message: "Payment status updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (err) {
        console.error("Error updating parcel status:", err);
        res.status(500).json({ success: false, message: err.message });
      }
    });

    // ---------------------------------------------
    // 💾 Save Payment info
    // ---------------------------------------------
    app.post("/payment-history", async (req, res) => {
      try {
        const { trackingId, userEmail, amount, transactionId, status } =
          req.body;

        if (!trackingId || !userEmail || !transactionId) {
          return res
            .status(400)
            .json({ success: false, message: "Missing required fields" });
        }

        const paymentDoc = {
          trackingId,
          userEmail,
          amount,
          transactionId,
          status,
          createdAt: new Date().toISOString(),
        };

        const result = await dataBasePayments.insertOne(paymentDoc);
        res.json({ success: true, data: result });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
      }
    });

    // ---------------------------------------------
    // 📜 Get User Payment History
    // ---------------------------------------------
    app.get("/payment-history", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res
            .status(400)
            .json({ success: false, message: "Email required" });
        }

        const payments = await dataBasePayments
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.json({ success: true, data: payments });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
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
