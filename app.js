const express = require("express");
const app = express();
app.use(express.json());

const { format, compareAsc } = require("date-fns");
var isValid = require("date-fns/isValid");
var isMatch = require("date-fns/isMatch");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const baseFolder = path.join(__dirname, "todoApplication.db");
let baseData = null;
const startServer = async () => {
  try {
    baseData = await open({
      filename: baseFolder,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("The server running at http://localhost:3000/")
    );
  } catch (err) {
    console.log("DataBase ERROR:`${err.message}`");
    process.exit(1);
  }
};
startServer();
//Convert OBJECT to response
const convertDataObjToResponse = (dbObj) => {
  return {
    id: dbObj.id,
    todo: dbObj.todo,
    priority: dbObj.priority,
    status: dbObj.status,
    category: dbObj.category,
    dueDate: dbObj.due_date,
  };
};

const categoryReq = (category) => {
  return category !== "WORK" && category !== "HOME" && category !== "LEARNING";
};

const priorityReq = (priority) => {
  return priority !== "HIGH" && priority !== "MEDIUM" && priority !== "LOW";
};

const statusReq = (status) => {
  return status !== "TO DO" && status !== "IN PROGRESS" && status !== "DONE";
};

const statusRes = (response) => {
  return response.status(400), response.send("Invalid Todo Status");
};
const priorityRes = (response) => {
  return response.status(400), response.send("Invalid Todo Priority");
};
const categoryRes = (response) => {
  return response.status(400), response.send("Invalid Todo Category");
};

app.get("/todos/", async (request, response) => {
  const { status, priority, search_q = "", category } = request.query;
  let getTodoSqlQuery = "";

  switch (true) {
    case category !== undefined && priority !== undefined:
      if (categoryReq(category)) {
        categoryRes(response);
      } else if (priorityReq(priority)) {
        priorityRes(response);
      } else {
        getTodoSqlQuery = `SELECT * FROM todo 
          WHERE category = '${category}' and priority = '${priority}';`;
      }
      break;

    case category !== undefined && status !== undefined:
      if (categoryReq(category)) {
        categoryRes(response);
      } else if (statusReq(status)) {
        statusRes(response);
      } else {
        getTodoSqlQuery = `SELECT * FROM todo 
          WHERE category = '${category}' and status = '${status}';`;
      }
      break;

    case priority !== undefined && status !== undefined:
      if (priorityReq(priority)) {
        priorityRes(response);
      } else if (statusReq(status)) {
        statusRes(response);
      } else {
        getTodoSqlQuery = `SELECT * FROM todo 
          WHERE priority = '${priority}' and status = '${status}';`;
      }
      break;

    case status !== undefined:
      if (statusReq(status)) {
        statusRes(response);
      } else {
        getTodoSqlQuery = `SELECT * FROM todo 
          WHERE status = '${status}';`;
      }
      break;

    case priority !== undefined:
      if (priorityReq(priority)) {
        priorityRes(response);
      } else {
        getTodoSqlQuery = `SELECT * FROM todo 
          WHERE priority = '${priority}';`;
      }
      break;

    case category !== undefined:
      if (categoryReq(category)) {
        categoryRes(response);
      } else {
        getTodoSqlQuery = `SELECT * FROM todo 
          WHERE category = '${category}';`;
      }
      break;

    default:
      getTodoSqlQuery = `SELECT * FROM todo
      WHERE todo like '%${search_q}%'`;
  }
  if (getTodoSqlQuery !== "") {
    const dbTodo = await baseData.all(getTodoSqlQuery);
    response.send(dbTodo.map((eachItem) => convertDataObjToResponse(eachItem)));
  }
});

app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getTodoIdQuery = `
            SELECT * FROM todo WHERE id = ${todoId};`;
  const dbResponse = await baseData.get(getTodoIdQuery);
  response.send(convertDataObjToResponse(dbResponse));
});

const newDate = (dueDate) => {
  return (formattedDate = format(new Date(dueDate), "yyyy-MM-dd"));
};

const validDate = (dueDate) => {
  const result = isValid(new Date(dueDate));
  return result;
};
const dateRes = (response) => {
  return response.status(400), response.send("Invalid Due Date");
};

app.get("/agenda/", async (request, response) => {
  let { date } = request.query;
  let agendaQuery = "";
  if (validDate(date) == false) {
    dateRes(response);
  } else {
    date = newDate(date.toString());
    agendaQuery = `
        SELECT * FROM todo WHERE due_date='${date}';`;
  }
  if (agendaQuery !== "") {
    const dbAgenda = await baseData.all(agendaQuery);
    response.send(
      dbAgenda.map((eachItem) => convertDataObjToResponse(eachItem))
    );
  }
});

//POST Request
app.post("/todos/", async (request, response) => {
  let { id, todo, priority, status, category, dueDate } = request.body;

  if (categoryReq(category)) {
    categoryRes(response);
  } else if (statusReq(status)) {
    statusRes(response);
  } else if (priorityReq(priority)) {
    priorityRes(response);
  } else if (validDate(dueDate) === false) {
    dateRes(response);
  } else {
    dueDate = newDate(dueDate.toString());
    const postSqlQuery = `
            INSERT INTO todo (id,todo,priority,status,category,due_date)
            VALUES (
                ${id},
                '${todo}',
                '${priority}',
               '${status}',
                '${category}',
                '${dueDate}'
            );`;
    await baseData.run(postSqlQuery);
    response.status(200);
    response.send("Todo Successfully Added");
  }
});

//PUT Request
app.put("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  let { todo, priority, status, category, dueDate } = request.body;
  let updateColumn = "";
  if (status !== undefined) {
    if (statusReq(status)) {
      statusRes(response);
    } else {
      updateColumn = "Status Updated";
    }
  } else if (priority !== undefined) {
    if (priorityReq(priority)) {
      priorityRes(response);
    } else {
      updateColumn = "Priority Updated";
    }
  } else if (category !== undefined) {
    if (categoryReq(category)) {
      categoryRes(response);
    } else {
      updateColumn = "Category Updated";
    }
  } else if (dueDate !== undefined) {
    if (validDate(dueDate) === false) {
      dateRes(response);
    } else {
      updateColumn = "Due Date Updated";
    }
  } else if (todo !== undefined) {
    updateColumn = "Todo Updated";
  }
  const previousDetailsQuery = `SELECT * FROM todo WHERE id=${todoId};`;
  const previousDetails = await baseData.get(previousDetailsQuery);
  (status = previousDetails.status),
    (priority = previousDetails.priority),
    (category = previousDetails.category),
    (todo = previousDetails.todo),
    (dueDate = newDate(previousDetails.due_date.toString()));

  const putTodoQuery = `
        UPDATE todo SET
        status = '${status}',
        priority = '${priority}',
        todo = '${todo}',
        category = '${category}',
        due_date = '${dueDate}'
        WHERE id = ${todoId};`;
  if (updateColumn !== "") {
    const dbData = await baseData.run(putTodoQuery);
    response.send(updateColumn);
  }
});

//DELETE TODO
app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodoQuery = `DELETE FROM todo WHERE id = ${todoId};`;
  await baseData.run(deleteTodoQuery);
  response.send("Todo Deleted");
});
module.exports = app;
