const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@simpledb.jrt478f.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    /* API NAMEING CONVENTION
     *app.get("/bookings")
     *app.get("/bookings/:id")
     *app.post("/bookings/")
     *app.patch("/bookings/:id")
     *app.delete("/bookings/:id")
     */

    const appointmentOptionDataCollection = client
      .db("DoctorsPortal")
      .collection("appointmentOptionData");
    const bookingCollection = client
      .db("DoctorsPortal")
      .collection("bookingData");

    // AppointmentOption API
    // Use Aggregate to query multiple collection and then merge data
    app.get("/appointmentOptionData", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const optionsData = await appointmentOptionDataCollection
        .find(query)
        .toArray();
      // Gat the booking on provide date
      const bookingQuery = { selectedDate: date };
      const allradyBooked = await bookingCollection
        .find(bookingQuery)
        .toArray();

      optionsData.forEach((option) => {
        const optionBooked = allradyBooked.filter(
          (booked) => booked.treatmentName === option.name
        );
        const bookedSlots = optionBooked.map(
          (bookedSlot) => bookedSlot.selectedTimeSlots
        );
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
        // console.log(date, option.name, bookedSlots);
        // console.log(remainingSlots);
      });
      res.send(optionsData);
    });
    // New system useing pipeline and aggrigate
    /* app.get("/v2/appointmentOptionData", async(req, res) => {
               const date = req.query.date;
               const potions = await appointmentOptionDataCollection.aggregate([
                    {
                         $lookup:{
                              from: 'bookingData',
                              localField: 'name',
                              foreignField: 'treatmentName',
                              pipeline: [
                                   {
                                        $match: {
                                             $expr: {
                                                  $eq: ['$selectedDate', date]
                                             }
                                        }
                                   }
                              ],
                              as: 'booked'
                         }
                    },
                    {
                         $project: {
                              name: 1,
                              slots: 1,
                              booked: {
                                   $map: {
                                        input: '$booked',
                                        as: 'book',
                                        in: '$$book.slot'
                                   }
                              }
                         }
                    },
                    {
                       $project: {
                         name: 1,
                         slots: {
                              $setDifference: ['slots', '$booked']
                         }

                       }  
                    }
               ]).toArray();
               res.send(potions);
          }) */

    // Post bookings data on database
    app.post("/bookingsData", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const query = {
        selectedDate: booking.selectedDate,
        treatmentName: booking.treatmentName,
      };
      const allReadyBooked = await bookingCollection.find(query).toArray();

      if (allReadyBooked.length) {
        const message = `You have allready ${booking.treatmentName} Booking this ${booking.selectedDate}`;
        return res.send({ acknowledged: false, message });
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // // Get all bookings data

    // app.get('/bookingsData', async(req, res) => {
    //      const booking = {};
    //      const bookingData = await bookingCollection.find(booking).toArray;
    //      res.send(bookingData);
    // })
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctors Portal Server is runing.....");
});

app.listen(port, () => {
  console.log(`Server is runing on port ${port}`);
});
