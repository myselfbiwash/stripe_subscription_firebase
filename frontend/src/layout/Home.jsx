import React, { useEffect, useState } from "react";
import basic from "../assets/basic.svg";
import pro from "../assets/pro.svg";
import business from "../assets/business.svg";
import firebase from "../firebase/firebaseConfig";

const data = [
  {
    id: 1,
    src: basic,
    title: "Basic",
    price: 40,
  },
  {
    id: 2,
    src: pro,
    title: "Pro",
    price: 250,
  },
  {
    id: 3,
    src: business,
    title: "Business",
    price: 500,
  },
];
const Home = () => {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [planType, setPlanType] = useState("");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState("");
  const [email, setEmail] = useState("");
  const [sessionId, setSessionId] = useState("");


  useEffect(() => {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        console.log("User", user);
        setUserId(user.uid);
        console.log("User ID", user.uid);
        setUserName(user.displayName);
        setEmail(user.email);
        setStripeSubscriptionId(user.stripeSubscriptionId);
        console.log("User Email",user.email);
        const userRef = firebase.database().ref("users/" + user.uid);
        userRef.on("value", (snapshot) => {
          const user = snapshot.val();
          if (user && user.subscription) {
            setPlanType(user.subscription.planType || "");
            setStripeCustomerId(user.stripeCustomerId || "");
            setSessionId(user.subscription.sessionId || "")
            setStripeSubscriptionId(user.stripeSubscriptionId )
            console.log("Stripe Subscription ID",user.stripeSubscriptionId);



            console.log("Stripe Customer ID", user.stripeCustomerId);

            console.log("User Subscription",user.subscription);
            console.log("User Subscription Type",user.subscription.planType);
            console.log("User Session ID",user.subscription.sessionId);
          }
        });
      } else {
        setUserId("");
        setUserName("");
      }
    });
  }, [userId]);

  const checkout = (plan) => {
    fetch("http://localhost:5000/api/v1/create-subscription-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "cors",
      body: JSON.stringify({ plan: plan, firebaseId: userId, email: email }),
    })
      .then((res) => {
        if (res.ok) return res.json();
        console.log("Response is: ",res);
        return res.json().then((json) => Promise.reject(json));
      })
      .then(({ session }) => {
        console.log("Session id in Home is:", session.subscription);
        window.location = session.url;
      })
      .catch((e) => {
        console.log("Error:",e.message);
      });
  };

  // handleManageSubscription function

  const handleManageSubscription = () => {
    console.log("Stripe Subscription ID ...............: ",stripeSubscriptionId);
    fetch("http://localhost:5000/api/v1/create-billing-portal-session",{
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "cors",
      body: JSON.stringify({ customerId: stripeCustomerId, stripeSubscriptionId: stripeSubscriptionId, sessionId: sessionId, email: email }),
    })
      .then((res) => {
        if (res.ok) return res.json();
        console.log("Response is: ",res);
        return res.json().then((json) => Promise.reject(json));
      })
      .then(({ url }) => {
        console.log("url is: ",url);
        window.location = url;
      })
      .catch((e) => {
        console.log("Error:",e.message);
      });

    // window.open( 'https://billing.stripe.com/p/login/test_8wMaGj177dec6RidQQ', '_blank');

    }

    const handleManageSubscriptionPortal = () => {
      // fetch("http://localhost:5000/api/v1/create-billing-portal-session",{
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   mode: "cors",
      //   body: JSON.stringify({ customerId: stripeCustomerId }),
      // })
      //   .then((res) => {
      //     if (res.ok) return res.json();
      //     console.log(res);
      //     return res.json().then((json) => Promise.reject(json));
      //   })
      //   .then(({ url }) => {
      //     console.log("url is: ",url);
      //     window.location = url;
      //   })
      //   .catch((e) => {
      //     console.log("Error:",e.message);
      //   });


      window.location = 'https://billing.stripe.com/p/login/test_8wMaGj177dec6RidQQ'
      }
  



  return (
    <>
      <div className="flex flex-col items-center w-full mx-auto min-h-screen diagonal-background overflow-x-hidden">
        <div className="flex justify-between items-center w-full px-6 h-20 bg-[#00000012]">
          <div className="text-4xl font-bold text-white">serVices</div>
          <div className="flex justify-center items-center gap-2">
            {!userId ? (
              <a
                href="/login"
                className="bg-white px-4 py-2 uppercase w-auto rounded-lg text-xl text-[#4f7cff] font-semibold"
              >
                Login
              </a>
            ) : (
              <div className="flex justify-center items-center space-x-4">
                <span className="text-white text-xl">{userName}</span>
                <button
                  onClick={() => firebase.auth().signOut()}
                  className="bg-white px-4 py-2 w-auto rounded-lg text-base uppercase font-semibold text-[#4f7cff]"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        <div
          className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-5 z-50 place-items-center w-9/12 mx-auto
        mt-20"
        >
          {data.map((item, idx) => (
            <div
              key={idx}
              className={`bg-white px-6 py-8 rounded-xl text-[#4f7cff] w-full mx-auto grid 
              place-items-center ${
                planType === item.title.toLowerCase() &&
                "border-[16px] border-green-400"
              }`}
            >
              <img
                src={item.src}
                alt=""
                width={200}
                height={200}
                className="h-40"
              />
              <div className="text-4xl text-slate-700 text-center py-4 font-bold">
                {item.title}
              </div>
              <p className="lg:text-sm text-xs text-center px-6 text-slate-500">
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Dignissimos quaerat dolore sit eum quas non mollitia
                reprehenderit repudiandae debitis tenetur?
              </p>
              <div className="text-4xl text-center font-bold py-4">
                ${item.price}
              </div>
              <div className="mx-auto flex justify-center items-center my-3">
                {planType === item.title.toLowerCase() ? (
                  <button onClick={() => handleManageSubscription()} className="bg-green-600 text-white rounded-md text-base uppercase w-auto py-2 px-4 font-bold">
                    Manage Subscription 
                  </button>
                )
                
                : (
                  <button
                  onClick={() => planType ? handleManageSubscription() : checkout(Number(item.price))}
                  className="bg-[#3d5fc4] text-white rounded-md text-base uppercase px-4 py-2 font-bold"
                >
                  {planType ? "Manage Subscription" : "Start"}
                </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
  <button onClick={handleManageSubscriptionPortal} >Manage Billing</button>
    </>
  );
};
export default Home;