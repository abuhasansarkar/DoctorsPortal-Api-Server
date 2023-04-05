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
          const appointmentOptionDataCollection = client.db("DoctorsPortal").collection("appointmentOptionData");
          app.get('/appointmentOptionData', async(req, res) => {
               const query = {};
               const optionsData = await appointmentOptionDataCollection.find(query).toArray();
               res.send(optionsData);

          })
     }
     finally{

     }
}
run().catch(console.dir);
// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });





app.get('/', (req, res) => {
  res.send('Doctors Portal Server is runing.....')
})

app.listen(port, () => {
  console.log(`Server is runing on port ${port}`)
})