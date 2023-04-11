const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_KEY_SK);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@simpledb.jrt478f.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// Create function, Middleware on JWT
function verifyJwtToken(req, res, next) {
  // console.log("JWT token veryfy", req.headers.jwtauthorization);
  const jwtAuthHeader = req.headers.jwtauthorization;
  if (!jwtAuthHeader) {
    return res.status(401).send("Unauthorized Access");
  }

  const jwtToken = jwtAuthHeader.split(" ")[1];
  jwt.verify(jwtToken, process.env.JWT_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    /* API NAMEING CONVENTION
     *app.get("/bookings")
     *app.get("/bookings/:id")
     *app.post("/bookings/")
     *app.patch("/bookings/:id")
     *app.delete("/bookings/:id")
     */
    // Appointment Option caollection
    const appointmentOptionDataCollection = client
      .db("DoctorsPortal")
      .collection("appointmentOptionData");
    //  Booking collection
    const bookingCollection = client
      .db("DoctorsPortal")
      .collection("bookingData");
    //  Users
    const usersDataCollection = client
      .db("DoctorsPortal")
      .collection("usersData");
    //  Doctors Data
    const doctorsDataCollection = client
      .db("DoctorsPortal")
      .collection("doctorsData");
    //  Payments Data
    const paymentsCollection = client
      .db("DoctorsPortal")
      .collection("payments");

    //  Admin Middleware
    // ==================================

    const virifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersDataCollection.findOne(query);
      if (user.role !== "admin") {
        return res.status(403).send({ message: "Unauthorize User" });
      }
      next();
    };

    // AppointmentOption API Start
    // =========================================
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

    //   Doctor page infor  Appoinment Specialty Data
    app.get("/appointmentSpecialty", async (req, res) => {
      const query = {};
      const result = await appointmentOptionDataCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
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

    // AppointmentOption API End

    // BookingsData API Start
    // ========================================

    app.get("/bookingsData", verifyJwtToken, async (req, res) => {
      const email = req.query.email;
      // console.log(req.headers.jwtauthorization);
      // JWT code start
      const decodedEmail = req.decoded.email;
      if (!email === decodedEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      // JWT code End
      const query = { userEmail: email };
      const bookingData = await bookingCollection.find(query).toArray();
      // console.log(bookingData);
      res.send(bookingData);
    });

    // Post bookings data on database
    app.post("/bookingsData", async (req, res) => {
      const booking = req.body;
      //  console.log(booking);
      const query = {
        selectedDate: booking.selectedDate,
        treatmentName: booking.treatmentName,
        userEmail: booking.userEmail,
      };
      const allReadyBooked = await bookingCollection.find(query).toArray();

      if (allReadyBooked.length) {
        const message = `You have allready ${booking.treatmentName} Booking this ${booking.selectedDate}`;
        return res.send({ acknowledged: false, message });
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookingsData/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await bookingCollection.findOne(filter);
      res.send(result);
      // console.log(result);
    });

    // BookingsData API End

    // Stripte Payments API Start
    app.post('/create-payment-intent', async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const totalAmount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        payment_method_types : ["card"]
        
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // Stripte Payments API End

    // usersData API Start
    // ============================
    // JWT API Start

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersDataCollection.findOne(query);
      if (user) {
        const jwtToken = jwt.sign({ email }, process.env.JWT_ACCESS_TOKEN, {
          expiresIn: "10h",
        });
        return res.send({ accesstoken: jwtToken });
      }
      // console.log(user);
      res.status(403).send({ accessToken: "" });
    });

    // JWT API End
    // Get Users Data Start

    app.get("/allusersData", async (req, res) => {
      const query = {};
      const users = await usersDataCollection.find(query).toArray();
      res.send(users);
    });

    // Check User isAdmin or not
    app.get("/allusersData/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersDataCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    // Add user role in user database
    app.put(
      "/allusersData/admin/:id",
      verifyJwtToken,
      virifyAdmin,
      async (req, res) => {
        /*  const decodedEmail = req.decoded.email;
        const query = {email: decodedEmail};
        const user = await usersDataCollection.findOne(query);
             if(user.role !== 'admin'){
                  return res.status(403).send({message: "Unauthorize User"})
             } */
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersDataCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        // console.log(result);
        res.send(result);
      }
    );

    // User Delete
    app.delete("/allusersData/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersDataCollection.deleteOne(query);
      res.send(result);
      // console.log(result);
    });

    // Send Register usersData info to Database

    app.post("/usersData", async (req, res) => {
      const users = req.body;
      // console.log(users);
      const result = await usersDataCollection.insertOne(users);
      res.send(result);
    });

    // usersData API End

    //     DoctorsData send to Database Start
    // Post Doctors information API
    app.post("/doctorsData", async (req, res) => {
      const doctorsData = req.body;
      // console.log(doctorsData);
      const result = await doctorsDataCollection.insertOne(doctorsData);
      res.send(result);
    });

    //Get Doctors Information API
    app.get("/doctorsData", verifyJwtToken, virifyAdmin, async (req, res) => {
      const query = {};
      const doctors = await doctorsDataCollection.find(query).toArray();
      res.send(doctors);
    });

    //delete Doctor API
    app.delete(
      "/doctorsData/:id",
      verifyJwtToken,
      virifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const deleteDoctor = await doctorsDataCollection.deleteOne(query);
        res.send(deleteDoctor);
        // console.log(deleteDoctor);
      }
    );

    // Payments API  Start
    // ===================================

    app.post('/payments', async(req, res) => {
      const payment = req.body;
      const paymentsInfo = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const result = await bookingCollection.updateOne(filter, updatedDoc)
      res.send(paymentsInfo);
      // console.log(result);
    })
    // Payments API End


    //     Temporary Price Data update in appointmentOptinsData colection

    /* app.get("/addprice", async (req, res) => {
      const filter = {};
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          price: 99,
        },
      };
      const result = await appointmentOptionDataCollection.updateMany(
        filter,
        updateDoc,
        options
      );
      res.send(result);
      console.log(result);
    }); */

    //  DoctorsData send to Database End
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
