import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));



const giftSchema = new mongoose.Schema({
  sender: String,
  giftName: String,
  giftImage: String,
  repeatCount: Number,
  count: Number,
  recipient: String,
  timestamp: { type: Date, default: Date.now }
});

const Gift = mongoose.model("Gift", giftSchema);

app.post("/api/gifts", async (req, res) => {
  try {
    const gift = new Gift(req.body);
    await gift.save();
    res.status(201).send(gift);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get("/api/gifts", async (req, res) => {
  const gifts = await Gift.find().sort({ timestamp: -1 });
  res.send(gifts);
});
app.put("/api/gifts/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { recipient } = req.body;

        const updatedGift = await Gift.findByIdAndUpdate(
            id,
            { recipient },
            { new: true }
        );

        res.status(200).send(updatedGift);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.get('/api/gifts/types', async (req, res) => {
    try {
        const gifts = await Gift.aggregate([
            {
                $group: {
                    _id: '$giftName', 
                    totalRepeatCount: { $sum: '$repeatCount' } 
                }
            }
        ]);

        const giftTypeCounts = gifts.reduce((acc, gift) => {
            acc[gift._id] = gift.totalRepeatCount; 
            return acc;
        }, {});

        res.json(giftTypeCounts); 
    } catch (error) {
        console.error('Error fetching gift types:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});

