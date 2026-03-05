export const successResponse = (res, data, message = "Success") => {
    return res.status(200).json({
      success: true,
      message,
      data,
    });
  };
  
  export const errorResponse = (res, error, status = 500) => {
    return res.status(status).json({
      success: false,
      message: error,
    });
  };