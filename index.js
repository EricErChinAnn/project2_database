const express = require("express");
const cors = require("cors");
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId;
const MongoUtil = require("./MongoUtil");
const { ObjectID } = require("mongodb");
const e = require("express");
const jwt = require("jsonwebtoken");

const mongoUrl = process.env.MONGO_URI

let app = express();

app.use(express.json());
app.use(cors());

async function main() {
    await MongoUtil.connect(mongoUrl, "fantasy_gourmet")
    console.log("Database Connected");
    const generateAccessToken = (id, email, password) => {
        return jwt.sign({
            "user_id": id,
            "email": email,
            "password": password
        }, process.env.TOKEN_SECRET, {
            expiresIn: "3h"
        })
    };
    const checkIfAuthenticatedJWT = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(" ")[1];
            jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
                if (err) {
                    return res.sendStatus(403);
                }

                req.user = user;
                next();
            });
        } else {
            res.sendStatus(401);
        }
    };
    const validation = (value, warning, res) => {
        if (!value) {
            res.status(400);
            res.json({ "error": warning })
            return;
        }
    }

    //Based Page
    app.get("/random", async (req, res) => {
        let result = await MongoUtil.getDB().collection("recipe").aggregate([
            {
                $lookup: {
                    from: "showGame",
                    localField: "showGameId",
                    foreignField: "_id",
                    as: "showGameId"
                }
            },
            {
                $lookup: {
                    from: "user",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userId"
                }
            },
            {
                $lookup: {
                    from: "tags",
                    localField: "foodTags",
                    foreignField: "_id",
                    as: "foodTags"
                }
            },
            {
                $lookup: {
                    from: "reviews",
                    localField: "reviewId",
                    foreignField: "_id",
                    as: "reviewId"
                }
            }
        ])
            .toArray();

        const randomize = (Math.floor(Math.random() * result.length));
        
        res.status(200);
        res.json(result[randomize]);
    })

    //Add new Recipe
    app.post("/addRecipe", async (req, res) => {
        try {
            validation(req.body.name, "Please enter your recipe name", res)
            let name = req.body.name;

            validation(req.body.category, "Please select a food category", res)
            let category = req.body.category;

            validation(req.body.estCost, "Please enter an estimated cost", res)
            let estCost = req.body.estCost;

            validation(req.body.reqIngredients, "Please enter the list of ingredients", res);
            req.body.reqIngredients = req.body.reqIngredients.filter(n=>n)

            let reqIngredients = req.body.reqIngredients;

            req.body.optionalIngredients=req.body.optionalIngredients.filter(n=>n)
            let optionalIngredients = req.body.optionalIngredients;

            req.body.prepSteps = req.body.prepSteps.filter(n=>n)
            let prepSteps = req.body.prepSteps;

            validation(req.body.steps, "Please enter the cooking proccess", res);
            req.body.steps=req.body.steps.filter(n=>n)
            let steps = req.body.steps;

            validation(req.body.picture, "Please upload a picture", res);
            let picture = req.body.picture;

            let lastEdit = (new Date()).getDate() + "/" + (new Date()).getMonth() + "/" + (new Date()).getFullYear();

            let prepDuration = req.body.prepDuration;

            validation(req.body.cookingDuration, "Please enter the cooking duration", res)
            let cookingDuration = req.body.cookingDuration;

            validation(req.body.cookingTools, "Please enter the tools used in this recipe", res)
            req.body.cookingTools=req.body.cookingTools.filter(n=>n)
            let cookingTools = req.body.cookingTools;

            let user = ObjectId(req.body.user_id);

            let foodTags = [];
            if (req.body.foodTags) {
                req.body.foodTags.forEach((each) => {
                    foodTags.push(ObjectId(each))
                })
            }
            let reviewId = req.body.reviewId;

            validation(req.body.showGameId, "Please select origin of the recipe", res)
            let showGameId = ObjectId(req.body.showGameId);

            let newRecipe =
            {
                "name": name,
                "category": category,
                "estCost": estCost,
                "ingredients": {
                    "req": reqIngredients,
                    "optional": optionalIngredients
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

            const db = MongoUtil.getDB();
            const resultRecipe = await db.collection("recipe").insertOne(newRecipe);
            res.status(200);
            res.json(resultRecipe);
        } catch (e) {
            console.log(e);
            res.status(500);
        }
    })

    app.get("/showGame", async (req, res) => {
        let results = await MongoUtil.getDB().collection("showGame").find().toArray()
        res.status(200);
        res.json(results)
    })

    //Show Searched Recipe
    app.get("/recipe", async (req, res) => {
        let search = {};

        //Search via name 
        if (req.query.name) {
            search["name"] = {
                "$regex": req.query.name,
                "$options": "i"
            }
        }

        //Search via Category
        if (req.query.category) {
            search["category"] = {
                "$regex" : req.query.category
            }
        }

        //Search via ShowGame ID
        if (req.query.showGameId) {
            search["showGameId"] = ObjectId(req.query.showGameId)
        }

        //Search via User ID
        if (req.query.userId) {
            search["userId"] = req.query.userId
        }

        if (req.query._id) {
            search["_id"] = ObjectId(req.query._id)
        }

        //Search via Ingredients Used
        if (req.query.reqIngredients) {

            // search["ingredients.req"] = {
            //     "$regex": req.query.reqIngredients,
            //     "$options": "i"
            // }

            let searchArray = [];

            if (Array.isArray(req.query.reqIngredients)) {
                req.query.reqIngredients.forEach((each) => {
                    searchArray.push(RegExp((each), "i"))
                })
                search["ingredients.req"] = {
                    "$all": searchArray
                }
            } else if (req.query.reqIngredients && (!Array.isArray(req.query.reqIngredients[0]))) {
                search["ingredients.req"] = {
                    "$in": [req.query.reqIngredients]
                }
            }
        }

        //Search via Est Cost
        if (req.query.estCostMin && req.query.estCostMax) {
            search["estCost"] = {
                "$gte": parseFloat(req.query.estCostMin),
                "$lte": parseFloat(req.query.estCostMax)
            }
        }

        let results = await MongoUtil.getDB().collection("recipe")
            .aggregate([
                {
                    $match: search
                },
                {
                    $lookup: {
                        from: "showGame",
                        localField: "showGameId",
                        foreignField: "_id",
                        as: "showGameId"
                    }
                },
                {
                    $lookup: {
                        from: "user",
                        localField: "userId",
                        foreignField: "_id",
                        as: "userId"
                    }
                },
                {
                    $lookup: {
                        from: "tags",
                        localField: "foodTags",
                        foreignField: "_id",
                        as: "foodTags"
                    }
                },
                {
                    $lookup: {
                        from: "reviews",
                        localField: "reviewId",
                        foreignField: "_id",
                        as: "reviewId"
                    }
                }
            ])
            .toArray();
        res.status(200);
        res.json(results)
    })

    app.get("/purerecipe", async (req, res) => {
        let search = {};

        //Search via name 
        if (req.query.name) {
            search["name"] = {
                "$regex": req.query.name,
                "$options": "i"
            }
        }

        //Search via Category
        if (req.query.category) {
            search["category"] = {
                "$regex" : req.query.category
            }
        }

        //Search via ShowGame ID
        if (req.query.showGameId) {
            search["showGameId"] = ObjectId(req.query.showGameId)
        }

        //Search via User ID
        if (req.query.userId) {
            search["userId"] = req.query.userId
        }

        if (req.query._id) {
            search["_id"] = ObjectId(req.query._id)
        }

        //Search via Ingredients Used
        if (req.query.reqIngredients) {

            // search["ingredients.req"] = {
            //     "$regex": req.query.reqIngredients,
            //     "$options": "i"
            // }

            let searchArray = [];

            if (Array.isArray(req.query.reqIngredients)) {
                req.query.reqIngredients.forEach((each) => {
                    searchArray.push(RegExp((each), "i"))
                })
                search["ingredients.req"] = {
                    "$all": searchArray
                }
            } else if (req.query.reqIngredients && (!Array.isArray(req.query.reqIngredients[0]))) {
                search["ingredients.req"] = {
                    "$in": [req.query.reqIngredients]
                }
            }
        }

        //Search via Est Cost
        if (req.query.estCostMin && req.query.estCostMax) {
            search["estCost"] = {
                "$gte": parseFloat(req.query.estCostMin),
                "$lte": parseFloat(req.query.estCostMax)
            }
        }

        let results = await MongoUtil.getDB().collection("recipe")
            .aggregate([
                {
                    $match: search
                }
            ])
            .toArray();
        res.status(200);
        res.json(results)
    })

    //Update Recipe via ID
    app.put("/updateRecipe/:recipeId", async (req, res) => {
        try {
            
            let lastEdit = (new Date()).getDate() + "/" + (new Date()).getMonth() + "/" + (new Date()).getFullYear()

            let reviewId = req.body.reviewId
            let user_id = ObjectId(req.body.user_id)

            let modification = {
                "lastEdit": lastEdit,
                "reviewId": reviewId,
                "userId": ObjectId(user_id),

            }

            let name = req.body.name;
            if (name) {
                modification["name"] = name;
            }

            let category = req.body.category;
            if (category) {
                modification["category"] = category;
            }

            let estCost = req.body.estCost;
            if (estCost) {
                modification["estCost"] = parseFloat(estCost);
            }

            let ingredientsReq = req.body.reqIngredients;
            if (ingredientsReq) {
                ingredientsReq=ingredientsReq.filter(n => n)
                modification["ingredients.req"] = ingredientsReq;
            }

            let ingredientsOptional = req.body.optionalIngredients;
            if (ingredientsOptional) {
                ingredientsOptional=ingredientsOptional.filter(n => n)
                modification["ingredients.optional"] = ingredientsOptional;
            }

            let prepSteps = req.body.prepSteps;
            if (prepSteps) {
                prepSteps=prepSteps.filter(n => n)
                modification["prepSteps"] = prepSteps;
            }

            let steps = req.body.steps;
            if (steps) {
                steps=steps.filter(n => n)
                modification["steps"] = steps;
            }

            let picture = req.body.picture;
            if (picture) {
                modification["picture"] = picture;
            }

            let prepDuration = req.body.prepDuration;
            if (prepDuration) {
                modification["duration.prep"] = prepDuration;
            }

            let cookingDuration = req.body.cookingDuration;
            if (cookingDuration) {
                modification["duration.cooking"] = cookingDuration;
            }

            let cookingTools = [];
            if (req.body.cookingTools) {
                req.body.cookingTools = req.body.cookingTools.filter(n=>n)
                req.body.cookingTools.forEach((each) => {
                    if(each){cookingTools.push(each)}
                })
                modification["cookingTools"] = cookingTools;
            }

            let foodTags = [];
            if (req.body.foodTags) {
                req.body.foodTags = req.body.foodTags.filter(n=>n)
                req.body.foodTags.forEach((each) => {
                    if(each){foodTags.push(ObjectId(each))}
                })
                modification["foodTags"] = foodTags;
            }

            let showGameId = req.body.showGameId;
            if (showGameId) {
                modification["showGameId"] = ObjectId(showGameId);
            }

            await MongoUtil.getDB().collection('recipe').updateOne({
                "_id": ObjectId(req.params.recipeId)
            }, {
                '$set': modification
            });

            res.status(200);
            res.json({
                'message': 'Update success'
            })

        } catch (e) {
            console.log(e);
            res.status(500);
        }
    })

    //Delete Recipe via ID
    app.delete("/deleteRecipe/:recipeId",async (req, res) => {
        try {
            let reviewToDelete = await MongoUtil.getDB().collection("recipe").findOne({ "_id": ObjectId(req.params.recipeId) })

            if (reviewToDelete.reviewId) {
                await MongoUtil.getDB().collection("reviews").deleteMany({ "_id": { "$in": reviewToDelete.reviewId } })
            }

            await MongoUtil.getDB().collection("recipe").deleteOne({ "_id": ObjectId(req.params.recipeId) })

            res.status(200);
            res.json({ "message": "Recipe have been deleted" })
        } catch (error) {
            res.status(500);
            res.json({ "error": error })
        }
    })

    //Add New ShowGame
    app.post("/newShowGame", checkIfAuthenticatedJWT, async (req, res) => {
        try {
            validation(req.body.name, "Please enter a name", res)
            let name = req.body.name;

            validation(req.body.category, "Please select a category of origin", res)
            let category = req.body.category;

            validation(req.body.info, "Please enter a short description of the Show or Game", res)
            let info = req.body.info;

            validation(req.body.picture, "Please upload a picture", res);
            let picture = req.body.picture;

            let newShowGame =
            {
                "name": name,
                "category": category,
                "info": info,
                "picture": picture
            }

            const resultShowGmae = await MongoUtil.getDB().collection("showGame").insertOne(newShowGame);
            res.status(200);
            res.json(resultShowGmae);
        } catch (e) {
            console.log(e);
            res.status(500);
        }
    })



    //========= Break ========= Break ========= Break ========= Break ========= Break ========= Break ========= Break ========= Break ========= Break 



    //Add new Review
    app.post("/:recipeId/addReview", async (req, res) => {
        try {
            let postedDate = (new Date()).getDate() + "/" + (new Date()).getMonth() + "/" + (new Date()).getFullYear();

            let userName = await MongoUtil.getDB().collection("user").findOne({ "_id": ObjectId(req.body.user_id) });

            validation(req.body.title, "Please enter your title", res)
            let title = req.body.title;

            validation(req.body.rating, "Please select a rating", res)
            let rating = Number(req.body.rating);

            validation(req.body.mainText, "Please enter your review", res)
            let mainText = req.body.mainText;

            let newReview =
            {
                "name": userName.name,
                "userId": ObjectId(req.body.user_id),
                "date": postedDate,
                "title": title,
                "rating": rating,
                "mainText": mainText
            }

            const resultReview = await MongoUtil.getDB().collection("reviews").insertOne(newReview);
            console.log(resultReview)

            await MongoUtil.getDB().collection("recipe").updateOne(
                {
                    "_id": ObjectId(req.params.recipeId)
                }, {
                "$addToSet": { reviewId: resultReview.insertedId }
            }
            );

            res.status(200);
            res.json(resultReview);
        } catch (e) {
            console.log(e);
            res.status(500);
        }
    })

    //Update Review via ID
    app.put("/updateReview/:reviewId", async (req, res) => {
        try {
            let postedDate = (new Date()).getDate() + "/" + (new Date()).getMonth() + "/" + (new Date()).getFullYear()

            let modification = {
                "date": postedDate,
            }

            let title = req.body.title;
            if (title) {
                modification["title"] = title;
            }

            let rating = req.body.rating;
            if (rating) {
                modification["rating"] = Number(rating);
            }

            let mainText = req.body.mainText;
            if (mainText) {
                modification["mainText"] = mainText;
            }

            let name = req.body.name;
            if (name) {
                modification["name"] = name;
            }

            let userId = req.body.userId;
            if (userId) {
                modification["userId"] = userId;
            }

            await MongoUtil.getDB().collection('reviews').updateOne({
                "_id": ObjectId(req.params.reviewId)
            }, {
                '$set': modification
            });

            res.status(200);
            res.json({
                'message': 'Update success'
            })


        } catch (e) {
            console.log(e);
            res.status(500);
        }
    })

    //Delete Review via ID
    app.delete("/deleteReview/:reviewId", async (req, res) => {
        try {
            await MongoUtil.getDB().collection("recipe").updateMany(
                {},
                { $pull: { reviewId: ObjectId(req.params.reviewId) } }
            )

            await MongoUtil.getDB().collection("reviews").deleteOne({ "_id": ObjectId(req.params.reviewId) })

            res.status(200);
            res.json({ "message": "Review have been deleted" })
        } catch (error) {
            res.status(500);
            res.json({ "error": error })
        }
    })



    //========= Break ========= Break ========= Break ========= Break ========= Break ========= Break ========= Break ========= Break ========= Break 



    //Add new Users
    app.post("/addUser", async (req, res) => {
        if (req.body.nameNewAcc
            && req.body.emailNewAcc
            && req.body.passwordNewAcc
            && req.body.dobNewAcc) {
            let name = req.body.nameNewAcc;
            let email = req.body.emailNewAcc;
            let password = req.body.passwordNewAcc;
            let dob = req.body.dobNewAcc;
            let age = Number((new Date()).getFullYear()) - Number(dob.split("-")[0])
            let profilePic = req.body.profilePicNewAcc;

            let newUser = {
                "name": name,
                "email": email,
                "password": password,
                "dob": dob,
                "age": age,
                "profilePic": profilePic
            }

            const db = MongoUtil.getDB();
            const result = await db.collection("user").insertOne(newUser);

            res.status(201);
            res.json({ "message": "New User account is Created" });
        }else{
            res.status(400);
            res.json({ "error": "Please enter the required fields" })
        }
    })

    //Login
    app.post("/login", async (req, res) => {
        let user = await MongoUtil.getDB().collection("user").findOne({
            "email": req.body.loginEmail,
            "password": req.body.loginPassword
        })
        if (user) {
            let accessToken = generateAccessToken(user._id, user.email, user.password);
            res.send({ accessToken })
        } else {
            res.send("Authentication Error")
        }
    })

    //Show User Account
    // app.get("/user/:userId", async (req, res) => {
    //     let result = await MongoUtil.getDB().collection("user").find({ "_id": ObjectId(req.params.userId) }).toArray();

    //     res.status(200);
    //     res.json(result);
    // })
    app.get("/user", async (req, res) => {
        let results = await MongoUtil.getDB().collection("user")
        .aggregate([
            {
                $match: {
                    "email":req.query.email
                } 
            }
        ]).toArray()
        res.status(200);
        res.json(results)
    })

    app.get("/userPass", async (req, res) => {
        search={}

        if(req.query.email){
            search["email"]=req.query.email
        }

        if(req.query.password){
            search["password"]=req.query.password
        }

        let results = await MongoUtil.getDB().collection("user")
        .aggregate([
            {
                $match: search
            }
        ]).toArray()
        res.status(200);
        res.json(results)
    })

    //Edit User
    app.put("/updateUser/:userId", checkIfAuthenticatedJWT, async (req, res) => {
        try {
            let age = Number((new Date()).getFullYear()) - Number(req.body.dob.split("/")[0])

            let modification = {
                "name": req.body.name,
                "email": req.body.email,
                "password": req.body.password,
                "dob": req.body.dob,
                "age": age,
                "profilePic": req.body.profilePic
            };

            const resultUpdateUser = await MongoUtil.getDB().collection("user").updateOne(
                { "_id": ObjectId(req.params.userId) },
                {
                    "$set": modification
                }
            )
            res.status(200);
            res.json({ "message": "User Updated" })
        } catch (e) {
            res.status(500);
            res.send(e);
            console.log(e);
        }
    })

    //Delete User
    app.delete("/deleteUser/:userId", checkIfAuthenticatedJWT, async (req, res) => {
        try {
            await MongoUtil.getDB().collection("user").deleteOne({ "_id": ObjectId(req.params.userId) })
            res.status(200);
            res.json({ "message": "User have been deleted" })
        } catch (error) {
            res.status(500);
            res.json({ "error": error })
        }
    })

    
    app.get("/tags", async (req, res) => {
        let results = await MongoUtil.getDB().collection("tags").find().toArray()
        res.status(200);
        res.json(results)
    })

}

main();

// app.listen(process.env.PORT || 3000, () => {
//     console.log("Server is Live");
// })

app.listen(3000, () => {
    console.log("Server is Live");
})

