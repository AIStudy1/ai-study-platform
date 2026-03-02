export const createCourse = async (req, res) => {
    try {
      const { title, description } = req.body;
  
      // Later: insert into Supabase
  
      res.status(201).json({
        success: true,
        message: "Course created successfully",
        data: { title, description },
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
  
  export const getAllCourses = async (req, res) => {
    try {
      // Later: fetch from Supabase
  
      res.status(200).json({
        success: true,
        message: "Courses fetched successfully",
        data: [],
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };