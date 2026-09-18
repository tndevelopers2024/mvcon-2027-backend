const express = require('express');
const router = express.Router();
const abstractUpload = require('../middleware/abstractUpload');
const {
  submitAbstract,
  getAllAbstracts,
  getAbstractById,
  deleteAbstract,
} = require('../controllers/abstractController');

router
  .route('/')
  .post(abstractUpload.single('abstractFile'), submitAbstract)
  .get(getAllAbstracts);

router
  .route('/:id')
  .get(getAbstractById)
  .delete(deleteAbstract);

module.exports = router;
