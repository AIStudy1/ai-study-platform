import {
  generateFlashcards,
  getFlashcardsDue,
  getFlashcardStats,
  reviewFlashcard,
  completeReviewSession,
  getFriends,
  searchUsers,
  addFriend,
  respondToFriend,
  getMyInviteCode,
} from "../controllers/flashcardController.js";

const flashcardRouter = express.Router();
flashcardRouter.use(authenticateUser);

// Flashcards
flashcardRouter.post("/generate",          generateFlashcards);
flashcardRouter.get("/due",                getFlashcardsDue);
flashcardRouter.get("/stats",              getFlashcardStats);
flashcardRouter.patch("/:id/review",       reviewFlashcard);
flashcardRouter.post("/session-complete",  completeReviewSession);

// Friends
flashcardRouter.get("/friends",                getFriends);
flashcardRouter.post("/friends/search",         searchUsers);
flashcardRouter.post("/friends/add",            addFriend);
flashcardRouter.patch("/friends/:id/respond",   respondToFriend);
flashcardRouter.get("/friends/invite-code",     getMyInviteCode);

export { flashcardRouter };
