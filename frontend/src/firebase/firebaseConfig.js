import firebase from "firebase/compat/app"
import "firebase/compat/auth"
import "firebase/compat/database"

const firebaseConfig = {
    apiKey: "AIzaSyCO7Y3ZxFnzuItgz6rnOSsIQp--oMnOvKg",
    authDomain: "stripe-payment-with-auth.firebaseapp.com",
    projectId: "stripe-payment-with-auth",
    storageBucket: "stripe-payment-with-auth.appspot.com",
    messagingSenderId: "210006838022",
    appId: "1:210006838022:web:0b2dd346775f295e536c87",
    measurementId: "G-RS8T84X11L"
};

if(!firebase.apps.length){
    firebase.initializeApp(firebaseConfig)
}



export default firebase
