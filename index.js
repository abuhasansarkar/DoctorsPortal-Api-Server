const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()

// Middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@simpledb.jrt478f.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
     try{
          /* API NAMEING CONVENTION
               *app.get("/bookings")
               *app.get("/bookings/:id")
               *app.post("/bookings/")
               *app.patch("/bookings/:id")
               *app.delete("/bookings/:id")
          */

          const appointmentOptionDataCollection = client.db("DoctorsPortal").collection("appointmentOptionData");
          const bookingCollection = client.db("DoctorsPortal").collection("bookingData");

          // AppointmentOption API 
          // Use Aggregate to query multiple collection and then merge data
          app.get('/appointmentOptionData', async(req, res) => {
               const date = req.query.date;
               const query = {};
               const optionsData = await appointmentOptionDataCollection.find(query).toArray();
               // Gat the booking on provide date
               const bookingQuery = {selectedDate:date};
               const allradyBooked = await bookingCollection.find(bookingQuery).toArray();

               optionsData.forEach(option => {
                    const optionBooked = allradyBooked.filter(booked => booked.treatmentName === option.name);
                    const bookedSlots = optionBooked.map(bookedSlot => bookedSlot.selectedTimeSlots);
                    const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
                    option.slots = remainingSlots;
                    // console.log(date, option.name, bookedSlots);
                    // console.log(remainingSlots);

               })
               res.send(optionsData);
               // console.log(allradyBooked);

          })

          // Post bookings data on database
          app.post('/bookingsData', async(req, res) => {
               const booking = req.body;
               const result = await bookingCollection.insertOne(booking);
               res.send(result);
          })

          // // Get all bookings data

          // app.get('/bookingsData', async(req, res) => {
          //      const booking = {};
          //      const bookingData = await bookingCollection.find(booking).toArray;
          //      res.send(bookingData);
          // })
     }
     finally{

     }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Doctors Portal Server is runing.....')
})

app.listen(port, () => {
  console.log(`Server is runing on port ${port}`)
})