const express = require("express");
const cors = require("cors");
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId;
const MongoUtil = require("./MongoUtil");

const mongoUrl = process.env.MONGO_URI

let app = express();

app.use(express.json());
app.use(cors());

async function main() {
    await MongoUtil.connect(mongoUrl, "fantasy_gourmet")
    console.log("Database Connected");

    //Based Page
    app.get("/", async (req, res) => {
        let result = await MongoUtil.getDB().collection("recipe").find().toArray();

        const randomize = (Math.floor(Math.random() * result.length));

        console.log(result[randomize]);
        res.status(200);
        res.json(result);
    })

    // Add new Recipe
    app.post("/addRecipe", async (req, res) => {

        // ObjectId(show._id) 
        // await db.collection("show").find({kehy: "lord of the ring"})..toArray()
        // let show = req.body.show.toLowerCase() ==> "lord of the ring"
        try {
            let name = req.body.name;
            let estCost = req.body.estCost;
            let ingredientsReq = req.body.ingredients.req;
            let ingredientsOptional = req.body.ingredients.optional;
            let prepSteps = req.body.prepSteps;
            let steps = req.body.steps;
            let picture = req.body.picture;
            let lastEdit = (new Date()).getDate() + "/" + (new Date()).getMonth() + "/" + (new Date()).getFullYear()
            let prepDuration = req.body.duration.prep;
            let cookingDuration = req.body.duration.cooking;
            let cookingTools = req.body.cookingTools;

            let user = "";
            let foodTags = [];
            let reviewId = [];
            let showGameId = "";

            //===== BREAK ===== BREAK ===== BREAK ===== BREAK ===== BREAK ===== BREAK ===== BREAK ===== BREAK ===== BREAK ===== BREAK =====

            let recipeId = "";
            let showName = "";
            let showCategory = "";
            let showInfo = "";
            let showAppearIn = "";
            let showPicture = "";

            if (!name || !estCost || !ingredientsReq ||
                !steps || !picture || !cookingDuration || !cookingTools ||
                !user || !showGameId || !showName || !showCategory ||
                !showInfo || !showAppearIn || !showPicture
            ) {
                res.status(400);
                res.json({ "error": "Please enter the required fields" })
                return;
            }

            let newRecipe =
            {
                "name": name,
                "estCost": estCost,
                "ingredients": {
                    "req": ingredientsReq,
                    "optional": ingredientsOptional
                },
                "prepSteps": prepSteps,
                "steps": steps,
                "picture": picture,
                "lastEdit": lastEdit,
                "duration": {
                    "prep": prepDuration,
                    "cooking": cookingDuration
                },
                "cookingTools": cookingTools,
                "userId": user,
                "showGameId": showGameId,
                "foodTags": foodTags,
                "reviewId": reviewId
            }

            let newShowGame = {
                "name": showName,
                "category": showCategory,
                "info": showInfo,
                "taggedTo": [
                    {
                        "recipeId": recipeId,
                        "appearIn": showAppearIn
                    }
                ],
                "picture": showPicture
            }

            const db = MongoUtil.getDB();
            const resultRecipe = await db.collection("recipe").insertOne(newRecipe);
            const resultShowGame = await db.collection("showGame").insertOne(newShowGame);
            res.status(200);
            res.json(resultRecipe);
            res.json(resultShowGame);

        } catch (e) {
            console.log(e);
            res.status(500);
        }
    })

    //Show Recipe
    app.get("/recipe", async (req, res) => {
        let search = {};

        //Search via name (This Works)
        if (req.query.name) {
            search["name"] = {
                "$regex": req.query.name,
                "$options": "i"
            }
        }

        //Search via ShowGame ID (This Works)
        if (req.query.showGameId) {
            search["showGameId"] = req.query.showGameId
        }

        //Search via Ingredients Used
        if (req.query.reqIngredients) {
            let searchArray = [];
            if (req.query.reqIngredients.isArray()) {
                req.query.reqIngredients.forEach((each)=>{
                    searchArray.push(RegExp((each),"i"))
                })
                search["ingredients.req"] = {
                    "$all": searchArray
                }
            } else if(req.query.reqIngredients) {
                search["ingredients.req"] = {
                    "$in": [req.query.reqIngredients]
                }
            }
        }

        //Search via Est Cost (This Works)
        if (req.query.estCostMin && req.query.estCostMax) {
            search["estCost"] = {
                "$gte": req.query.estCostMin,
                "$lte": req.query.estCostMax
            }
        }

        console.log(search);

        let results = await MongoUtil.getDB().collection("recipe").find(search).toArray();
        res.status(200);
        res.json(results)
    })

    //Add new Users
    app.post("/addUser", async (req, res) => {

        let name = req.body.name;
        let email = req.body.email;
        let password = req.body.password;
        let dob = req.body.dob;
        let age = Number((new Date()).getFullYear()) - Number(dob.split("/")[2])
        let profilePic = req.body.profilePic;

        if (!name || !email || !password || !dob) {
            res.status(400);
            res.json({ "error": "Please enter the required fields" })
        }

        let newUser = {
            "name": name,
            "email": email,
            "password": password,
            "dob": dob,
            "age": age,
            "profilePic": profilePic,
            "recipeId": [],
            "reviewsId": []
        }

        const db = MongoUtil.getDB();
        const result = await db.collection("user").insertOne(newUser);

        res.status(200);
        res.json(result);
    })
}

main();

app.listen(3000, () => {
    console.log("Server is Live");
})
