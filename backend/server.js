require("dotenv").config()
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json")
const express = require("express");
const app = express()
const cors = require("cors");
const bodyParser = require("body-parser");
const moment = require("moment");
const port = 5000


// app.use(express.json())
// app.use(bodyParser.json())

app.use("/api/v1", express.json());
app.use("/api/v1", express.urlencoded({ extended: true }));


const [basic,pro,business] = 
['price_1PvvFK07R5NqkYfbqKU2k0OT', 'price_1PvvGK07R5NqkYfbwvVTsMnw', 'price_1PvvH407R5NqkYfbJxTFCYSM'];

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://stripe-payment-with-auth-default-rtdb.firebaseio.com"
  });
  

app.use(
    cors({
        origin:"http://localhost:5173"
    })
)

const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY)


/*********** create subscription ************/

const stripeSession = async(plan, firebaseId) => {
    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: plan,
                    quantity: 1
                },
            ],
            success_url: "http://localhost:5173/",
            cancel_url: "http://localhost:5173/cancel",
            metadata: {
                firebaseId: firebaseId,
            },
        });
        // console.log("Session created:", session); // Add logging for session details
        // console.log("Session Metadata for firebaseId:", session.metadata.firebaseId);

        return session;
    }catch (e){
        return e;
    }
};
const createCustomer = async (email, userId) => {
    try {
        const customer = await stripe.customers.create({
            email: email,
            metadata: {
                firebaseId: userId,
            }
        });
        console.log("Customer created .....................:", customer);
        
        // Save customerId to Firebase
        await admin.database().ref("users").child(userId).update({
            stripeCustomerId: customer.id
        });
        console.log(`Stripe customer ID saved to Firebase for user ${userId}`);
        return customer.id;
    } catch (error) {
        console.message("Error creating customer:", error);
        throw error;
    }
};


//create subscription
app.post("/api/v1/create-subscription-checkout-session", async(req, res) => {
    const {plan, email, firebaseId} = req.body;
    console.log("Plan is: ",plan);
    // console.log("Customer id is: ",customerId);
    let planId;
    if(plan == 40) planId = basic;
    else if(plan == 250) planId = pro;
    else if(plan == 500) planId = business;

    console.log("Plan id is: ", planId);

    if (!planId) {
        throw new Error('Invalid plan');
    }

    try{
              // Fetch or create customer in Stripe
              const userSnapshot = await admin.database().ref("users").child(firebaseId).once("value");
              let customerId = userSnapshot.val().stripeCustomerId;
      
              // If the user doesn't have a Stripe customerId, create one
              if(!customerId) {
                  
                customerId = await createCustomer(email, firebaseId);

                // console.log("Customer id is here: ",customerId);

              }
            //   console.log("Customer id is: ",customerId);

        const session = await stripeSession(planId, firebaseId);
        // console.log("Checkout Session initiated is:", session);

        const user = await admin.auth().getUser(firebaseId);

        await admin.database().ref("users").child(user.uid).update({
            subscription: {
                sessionId: session.id,
                // subscriptionId: session.subscription, //I think here,  session.subscription is null
                firebaseId: firebaseId,
                
                
            }
        });
        return res.json({session})

    }catch(error){
        res.send(error)
    }
})


//Manage Subscription
app.post("/api/v1/create-billing-portal-session", async (req, res) => {
    // console.log("I am here")
    const { customerId, subscriptionId, sessionId } = req.body;
    
 
    
            
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            // subscription: subscriptionId,  //instead send subscription id
            return_url: 'http://localhost:5173', // Redirect the user back to your app after managing their subscription
            // flow_data: {
            //     type: 'subscription_update',
             
            //   },
        });


        res.json({ url: session.url });
    } 


    catch (error) {
        // console.message("Error creating billing portal session:", error);
        res.status(500).send(error);
    }
}

);


//customer portal session

app.post("/api/v1/create-customer-portal-session", async (req, res) => {
    const { customerId } = req.body; // customerId needs to be passed in the body of the request

    try {
        // Create a portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId, // The Stripe customer ID
            return_url: 'http://localhost:5173/', // Redirect URL after managing billing
            flow_data: {
                type: 'subscription_update',
                subscription_update: {
                  subscription: '{{subscription_id}}',
                },
        },
        });

        // Respond with the session URL
        res.json({ url: session.url });
        // res.json({ url: process.env.STRIPE_PORTAL_URL });
    } catch (error) {
        console.message("Error creating billing portal session:", error);
        res.status(500).send(error);
    }
});





/************ payment success ********/

app.post("/api/v1/payment-success", async (req, res) => {
    // console.log(req.body);
    const { sessionId, firebaseId } = req.body;
  
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log("Session status in backend of payment success:", session);
  
      if (session.payment_status === 'paid') {
          const subscriptionId = session.subscription;
        //   console.log("Stripe Customer ID in the Database:", session.stripeCustomerId)
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId); //retrieves details of a specific subscription from Stripe using the Stripe API
            const user = await admin.auth().getUser(firebaseId);
            const planId = subscription.plan.id;
            const planType = subscription.plan.amount === 4000 ? "basic" : subscription.plan.amount === 25000 ? "pro": "business";
            // const planType = planId === "basic" ? "basic" : planId === "pro" ? "pro" : "business";

            const startDate = moment.unix(subscription.current_period_start).format('YYYY-MM-DD');
            const endDate = moment.unix(subscription.current_period_end).format('YYYY-MM-DD');
            const durationInSeconds = subscription.current_period_end - subscription.current_period_start;
            const durationInDays = moment.duration(durationInSeconds, 'seconds').asDays();
            await admin.database().ref("users").child(user.uid).update({ 
                stripeSubscriptionId: subscriptionId,
                subscription: {
                  sessionId: null,
                  planId:planId,
                  planType: planType,
                  planStartDate: startDate,
                  planEndDate: endDate,
                  planDuration: durationInDays
                }});
  
              
            } catch (error) {
              console.message('Error retrieving subscription:', error);
            }
          return res.json({ message: "Payment successful" });
        } else {
          return res.json({ message: "Payment failed" });
        }
      } catch (error) {
        res.send(error);
      }
    });
  

    // Stripe requires the raw body to validate the signature
    const rawBodyParser = bodyParser.raw({ type: 'application/json' });

/*********** Stripe Webhook Endpoint ************/
app.post("/webhook", rawBodyParser, async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // console.log("Signature: ", sig)

    let event;

    try {

         // `req.body` should be a Buffer containing the raw body data
         const rawBody = req.body;
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);  //This line of code constructs a Stripe event object from the raw request body, the signature, and the endpoint secret.
        // console.log("Stripe event Object:", event);
        console.log("Stripe event:", event.type);
        
    } catch (err) {
        console.message(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // console.log("Stripe event subscription updated:", event.type);


    // Handle the event
    switch (event.type) {
        case "invoice.payment_failed":
            await handlePaymentFailed(event.data.object);
            break;

        case "customer.subscription.updated":
            await handleSubscriptionUpdated(event.data.object);
            break;

        case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event.data.object);
            break;

        case "customer.subscription.trial_will_end":
            await handleTrialEndingSoon(event.data.object);
            break;

        case "checkout.session.completed":
            await handleCheckoutSessionCompleted(event.data.object, req, res);
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

/********** Event Handlers for Subscription Management **********/

// Payment Failed
const handlePaymentFailed = async (invoice) => {
    // console.log("Payment failed for invoice:", invoice.id);
    const customerId = invoice.customer;
    const userSnapshot = await admin.database().ref("users").orderByChild("stripeCustomerId").equalTo(customerId).once("value");
    
    const userData = userSnapshot.val();
    if (userData) {
        const userKey = Object.keys(userData)[0];
        if (userKey) {
            await admin.database().ref("users").child(userKey).update({
                "subscription.status": "payment_failed"
            });
            console.log(`Updated subscription status to payment_failed for user ${userKey}`);
        } else {
            console.log("No user key found for the given customer ID.");
        }
    } else {
        console.log("No user found with the given customer ID.");
    }
};
// //checkout session completed
const handleCheckoutSessionCompleted = async (session) => {
    // const session = event.data.object;
    console.log("I am completed and notified i.e. checkout completed")
    console.log("Session after the checkout session has been completed is:", session)
    // console.log("Customer Id in the handle Checkout completed section in webhook:", session.customer)   
        // const subscriptionId = session.subscription;
        //saving this subscription id in the firebase
        // console.log('Subscription ID inside HandleCheckout session completed:', subscriptionId);


        try {
            
            if (session.payment_status === 'paid') {
                const subscriptionId = session.subscription;
              //   console.log("Stripe Customer ID in the Database:", session.stripeCustomerId)
                try {
                  const subscription = await stripe.subscriptions.retrieve(subscriptionId); //retrieves details of a specific subscription from Stripe using the Stripe API
                  console.log("Subscription details after the checkout session has been completed:", subscription);
                  const user = await admin.auth().getUser(session.metadata.firebaseId);
                  const planId = subscription.plan.id;
                  const planType = subscription.plan.amount === 4000 ? "basic" : subscription.plan.amount === 25000 ? "pro": "business";
                  // const planType = planId === "basic" ? "basic" : planId === "pro" ? "pro" : "business";
      
                  const startDate = moment.unix(subscription.current_period_start).format('YYYY-MM-DD');
                  const endDate = moment.unix(subscription.current_period_end).format('YYYY-MM-DD');
                  const durationInSeconds = subscription.current_period_end - subscription.current_period_start;
                  const durationInDays = moment.duration(durationInSeconds, 'seconds').asDays();
                  await admin.database().ref("users").child(user.uid).update({ 
                      stripeSubscriptionId: subscriptionId,
                      subscription: {
                        sessionId: null,
                        planId:planId,
                        planType: planType,
                        planStartDate: startDate,
                        planEndDate: endDate,
                        planDuration: durationInDays
                      }});
        
                    
                  } catch (error) {
                    console.message('Error retrieving subscription:', error);
                  }
                return res.json({ message: "Payment successful" });
              } else {
                return res.json({ message: "Payment failed" });
              }
            } catch (error) {
              console.log(error);
            }
    // console.log("Checkout session completed:");

};

// Subscription Updated
const handleSubscriptionUpdated = async (subscription) => {
    console.log("Subscription updated:", subscription.id);
    const customerId = subscription.customer;
    console.log("Subscription customer ID:", customerId);
    const userSnapshot = await admin.database().ref("users").orderByChild("stripeCustomerId").equalTo(customerId).once("value");
    const userData = userSnapshot.val();
    console.log("User data is: ", userData);

    if (userData) {
        const userKey = Object.keys(userData)[0]; // Extract the user key
        const user = userData[userKey]; // Get the user data

        const planId = subscription.plan.id;
        const planType = planId === "basic" ? "basic" : planId === "pro" ? "pro" : "business";
        const startDate = moment.unix(subscription.current_period_start).format('YYYY-MM-DD');
        const endDate = moment.unix(subscription.current_period_end).format('YYYY-MM-DD');

        await admin.database().ref("users").child(userKey).update({
            "subscription.planId": planId,
            "subscription.planType": planType,
            "subscription.planStartDate": startDate,
            "subscription.planEndDate": endDate,
            "subscription.status": subscription.status
        });

        console.log(`Updated subscription for user ${userKey}: Plan Type - ${planType}, Status - ${subscription.status}`);
    } else {
        console.log("No user found with the given customer ID.");
    }
};

// Subscription Deleted
const handleSubscriptionDeleted = async (subscription) => {
    try {
        
        const customerId = subscription.customer;
        console.log("Customer ID in delete section is:", customerId);
        const userSnapshot = await admin.database().ref("users").orderByChild("stripeCustomerId").equalTo(customerId).once("value");
        console.log("User snapshot in delete section is:", userSnapshot.val());
        //console stripeCustomerId
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            const userKey = Object.keys(userData)[0];
            console.log("User key in delete section is:", userKey);

            if (userKey) {
                await admin.database().ref("users").child(userKey).update({
                    stripeSubscriptionId: null,
                    "subscription.status": "canceled"
                });

                console.log(`Subscription canceled for user ${userKey}`);
            } else {
                console.message("User key not found.");
            }
        } else {
            console.message("No user found with the given customer ID.");
        }
    } catch (error) {
        console.message("Error handling subscription deletion:", error);
    }
};

// Trial Will End Soon
const handleTrialEndingSoon = async (subscription) => {
    const customerId = subscription.customer;
    const userSnapshot = await admin.database().ref("users").orderByChild("stripeCustomerId").equalTo(customerId).once("value");
    const userKey = Object.keys(userSnapshot.val())[0];

    if (userKey) {
        // Notify user that their trial is ending soon
        console.log(`Notified user ${userKey} that trial is ending soon.`);
    }
};
         
app.listen(port, () => {
    console.log(`Now listening on port ${port}`);
})