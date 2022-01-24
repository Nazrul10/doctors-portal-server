const express = require('express')
const app = express()
const { MongoClient } = require('mongodb');
const cors = require('cors')
const ObjectId = require('mongodb').ObjectId
const admin = require("firebase-admin");
require('dotenv').config();
const stripe = require("stripe")(process.env.SECRATE_STRIPE);
const fileUpload = require('express-fileupload');

const port = process.env.PORT || 5000

//midwer ware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

//
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fvtu8.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//veryfy token


const serviceAccount = require("./doctors-portal-firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
async function verifyToken(req, res, next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];

    try{
      const decodedUser = await admin.auth().verifyIdToken(token)
      req.decodedEmail = decodedUser.email;
    }
    catch{

    }

  }
  next();
}

//
async function run() {
    try {
      await client.connect();
      const database = client.db("dorcot_portal");
      const appoinmentCollection = database.collection("appoinments");
      const userCollection = database.collection('users')
      const doctorsCollection = database.collection('doctors')
      
      //appoinments post
     app.post('/appoinments', async (req, res)=>{
         const quary = req.body;
         const result = await appoinmentCollection.insertOne(quary);
         res.json(result)
     });
     //Dashboard get data
     app.get('/appoinments', verifyToken, async (req, res)=>{
         const email = req.query.email;
         const date = new Date(req.query.date).toLocaleDateString();
         const query = {email: email, date: date};
         const cursor = appoinmentCollection.find(query);
         const result = await cursor.toArray();
         res.json(result)
     });
     //Dashboard get data
     app.get('/appoinments/:id', async (req, res)=>{
         const id = req.params.id
         const query = {_id: ObjectId(id)}
         const result = await appoinmentCollection.findOne(query)
         res.json(result)
     });
     // Upsert: new user set on database Note: one user never set 2nd time
     app.post('/users', async (req, res)=>{
         const user = req.body;
         const result = await userCollection.insertOne(user);
         res.json(result);
     })
     // Upsert: new user set on database with google filter Note: one user never set 2nd time
     app.put('/users', async (req, res)=>{
         const user = req.body;
         const filter = { email: user.email };
         const options = { upsert: true };
         const updateDoc = { $set: user };
         const result = await userCollection.updateOne(filter, updateDoc, options);
         res.json(result)
     })
     // Make an admin , just add on dabase a rote: example, with use update mathod 
     app.put('/users/admin', verifyToken, async(req, res)=>{
       const user = req.body;
       //token verify
       const requester = req.decodedEmail;
       if(requester){
         const requesterAccount = await userCollection.findOne({email: requester});
          if(requesterAccount.role === 'admin'){

                const filter = {email: user.email}
                const updateDoc = {$set: {role : 'admin'}}
                const result = await userCollection.updateOne(filter, updateDoc);
                res.json(result)
          }
       }
       else{
         res.status(403).json({message : 'you do not have access to make admin'}) 
       }

      //  const filter = {email: user.email}
      //  const updateDoc = {$set: {role : 'admin'}}
      //  const result = await userCollection.updateOne(filter, updateDoc);
      //  res.json(result)
     })
     // Get admin with using email
     app.get('/users/:email', async(req, res)=>{
       const email = req.params.email;
       const query = {email: email};
       const result = await userCollection.findOne(query);
       let isAdmin = false;
       if(result?.role === 'admin'){
         isAdmin = true;
       }
       res.json({admin: isAdmin})
       // it's recive on firebase bcz it will use so many defarent place
     })
      //pyments
      app.post("/create-payment-intent", async (req, res) => {
        const paymentInfo = req.body;
        const amount = paymentInfo.price * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ['card']
        });
        res.json({clientSecret: paymentIntent.client_secret});
      });
      // image upload
      app.post('/doctors', async (req, res)=>{
        const name = req.body.name;
        const email = req.body.email;
        const pic = req.files.image;
        const picData = pic.data;
        const encodePic = picData.toString('base64');
        const imageBuffer = Buffer.from(encodePic, 'base64');
        const doctor = {
          name,
          email,
          image: imageBuffer,
        }
        const result = await doctorsCollection.insertOne(doctor);
        res.json(result);
      })
      // add doctors to find doctors
      app.get('/doctors', async (req, res)=>{
        const cursor = doctorsCollection.find({});
        const doctors = await cursor.toArray();
        res.json(doctors);
      })
      // payment update on database
      app.put('/appoinments/:id', async(req, res)=>{
        const id = req.params.id;
        const payment = req.body;
        const filter = {_id: ObjectId(id)};
        const updateDoc = {
          $set:{payment: payment}
        };
        const result = await appoinmentCollection.updateOne(filter, updateDoc);
        res.json(result);
      })

    } finally {
    //   await client.close();
    }
  }
  run().catch(console.dir);

//
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})