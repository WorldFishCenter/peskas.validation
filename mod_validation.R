#' validation UI Function
#' @noRd
mod_validation_ui <- function(id) {
  ns <- NS(id)

  tagList(
    # Authentication panel
    conditionalPanel(
      condition = paste0("!output['", ns("is_authenticated"), "']"),
      tags$div(
        class = "mb-3",
        tags$label(class = "form-label", "Username"),
        textInput(ns("username"), NULL, width = "100%", placeholder = "Enter username")
      ),
      tags$div(
        class = "mb-3",
        tags$label(class = "form-label", "Password"),
        passwordInput(ns("password"), NULL, width = "100%", placeholder = "Enter password")
      ),
      tags$div(
        class = "d-flex justify-content-end",
        actionButton(ns("login"), "Login", class = "btn-primary")
      )
    ),

    # Main content panel
    conditionalPanel(
      condition = paste0("output['", ns("is_authenticated"), "']"),
      tags$div(
        class = "row mb-3",
        tags$div(
          class = "col-12",
          reactable::reactableOutput(ns("submissions_table"))
        )
      ),
      tags$div(
        class = "row",
        tags$div(
          class = "col-12",
          tags$div(
            class = "alert alert-warning py-2 mb-3",
            style = "max-width: 400px; border-left: 4px solid #fd7e14;",
            tags$div(
              class = "d-flex align-items-center gap-2",
              icon_info(size = 14),
              tags$div(
                style = "font-size: 0.875rem;",
                textOutput(ns("selected_id"), inline = TRUE)
              )
            )
          )
        )
      ),
      tags$div(
        class = "row g-2",
        tags$div(
          class = "col-auto",
          tags$div(
            class = "form-group mb-0",
            tags$label(class = "form-label", "Assign Status"),
            tags$div(
              style = "width: 200px;",
              selectInput(
                ns("status"),
                NULL,
                choices = c(
                  "Approved" = "validation_status_approved",
                  "Not Approved" = "validation_status_not_approved",
                  "On Hold" = "validation_status_on_hold"
                ),
                width = "100%"
              )
            )
          )
        ),
        tags$div(
          class = "col-auto d-flex align-items-end",
          actionButton(
            ns("update_status"),
            "Update Status",
            class = "btn btn-primary",
            style = "height: 38px;"
          )
        ),
        tags$div(
          class = "col-auto d-flex align-items-end",
          tags$a(
            id = ns("edit_link"),
            href = "#",
            target = "_blank",
            class = "btn btn-secondary disabled",
            style = "height: 38px;",
            "Edit Submission"
          )
        )
      ),
      tags$div(
        class = "row mt-3",
        tags$div(
          class = "col-12",
          conditionalPanel(
            condition = paste0("output['", ns("has_update_message"), "']"),
            tags$div(
              class = "alert alert-primary mb-0",
              textOutput(ns("update_message"))
            )
          )
        )
      )
    )
  )
}

#' validation Server Functions
#' @noRd
mod_validation_server <- function(id) {
  moduleServer(id, function(input, output, session) {
    ns <- session$ns

    # Memoized helpers
    status_colors <- memoise::memoise(function(value) {
      switch(value,
        "validation_status_approved" = "#57A773",
        "validation_status_not_approved" = "#D34E24",
        "validation_status_on_hold" = "#89909F",
        "#000000"
      )
    })

    # Reactive values
    user_auth <- reactiveVal(FALSE)
    submissions_data <- reactiveVal(peskas.malawi.portal::validation_table)
    has_update_message <- reactiveVal(FALSE)

    # Authentication
    observeEvent(input$login, {
      if (input$username == get_pars()$validation$user &&
        input$password == get_pars()$validation$pass) {
        user_auth(TRUE)
      }
    })

    # Edit link handling
    observe({
      selected_data <- selected_row()

      if (!is.null(selected_data)) {
        edit_url <- generate_edit_url(selected_data$submission_id)

        if (!is.null(edit_url)) {
          shinyjs::removeClass("edit_link", "disabled")
          shinyjs::runjs(sprintf(
            "document.getElementById('%s').href = '%s';",
            ns("edit_link"),
            edit_url
          ))
        }
      } else {
        shinyjs::addClass("edit_link", "disabled")
        shinyjs::runjs(sprintf(
          "document.getElementById('%s').href = '#';",
          ns("edit_link")
        ))
      }
    })

    output$is_authenticated <- reactive(user_auth())
    outputOptions(output, "is_authenticated", suspendWhenHidden = FALSE)

    # Data processing
    table_data <- reactive({
      submissions_data() %>%
        dplyr::arrange(dplyr::desc(.data$submission_date)) %>%
        dplyr::mutate(submission_date = as.Date(.data$submission_date))
    }) %>% bindCache(submissions_data())

    # Table rendering
    output$submissions_table <- reactable::renderReactable({
      req(table_data())

      reactable::reactable(
        table_data(),
        theme = reactablefmtr::nytimes(),
        filterable = TRUE,
        defaultPageSize = 10,
        resizable = TRUE,
        width = "100%",
        selection = "single",
        onClick = "select",
        rowStyle = htmlwidgets::JS("function(rowInfo) {
          if (rowInfo && rowInfo.selected) {
            return { backgroundColor: '#eee', boxShadow: 'inset 2px 0 0 0 #ffa62d' }
          }
        }"),
        columns = list(
          submission_id = reactable::colDef(
            name = "Submission ID",
            minWidth = 120,
            resizable = TRUE
          ),
          submission_date = reactable::colDef(
            name = "Submission Date",
            minWidth = 120,
            format = reactable::colFormat(date = TRUE, locales = "en-GB"),
            resizable = TRUE
          ),
          vessel_number = reactable::colDef(
            name = "Vessel",
            minWidth = 80,
            align = "center",
            resizable = TRUE
          ),
          catch_number = reactable::colDef(
            name = "Catch",
            minWidth = 80,
            align = "center",
            resizable = TRUE
          ),
          alert_number = reactable::colDef(
            name = "Alert",
            minWidth = 80,
            align = "center",
            resizable = TRUE
          ),
          validation_status = reactable::colDef(
            name = "Status",
            minWidth = 120,
            cell = function(value) {
              color <- status_colors(value)
              htmltools::tags$span(
                style = list(
                  color = "white",
                  backgroundColor = color,
                  padding = "0.25rem 0.5rem",
                  borderRadius = "0.25rem",
                  display = "inline-block",
                  width = "100%",
                  textAlign = "center"
                ),
                gsub("validation_status_", "", value)
              )
            },
            resizable = TRUE
          ),
          validated_at = reactable::colDef(
            name = "Last Validated",
            minWidth = 150,
            format = reactable::colFormat(
              datetime = TRUE,
              locales = "en-GB"
            ),
            resizable = TRUE
          )
        ),
        highlight = TRUE,
        striped = TRUE,
        compact = TRUE,
        showSortIcon = TRUE,
        showPageSizeOptions = TRUE,
        pageSizeOptions = c(10, 20, 50, 100),
        showPageInfo = TRUE
      )
    }) %>% bindCache(table_data())

    # Selection handling
    selected_index <- reactive({
      reactable::getReactableState("submissions_table", "selected")
    }) %>% bindCache(reactable::getReactableState("submissions_table", "selected"))

    selected_row <- reactive({
      idx <- selected_index()
      if (!is.null(idx) && length(idx) > 0) {
        table_data()[idx, ]
      } else {
        NULL
      }
    }) %>% bindCache(selected_index(), table_data())

    # Update status handling
    observeEvent(input$update_status, {
      selected_data <- selected_row()

      if (is.null(selected_data)) {
        has_update_message(TRUE)
        output$update_message <- renderText("Please select a submission before updating status")
        return()
      }

      result <- update_validation_status(
        submission_id = selected_data$submission_id,
        validation_status = input$status,
        asset_id = get_pars()$kobo$asset_id,
        token = get_pars()$kobo$token
      )

      has_update_message(TRUE)

      if (!grepl("Error|HTTP 400", result)) {
        current_data <- submissions_data()
        current_data$validation_status[current_data$submission_id == selected_data$submission_id] <- input$status
        current_data$validated_at[current_data$submission_id == selected_data$submission_id] <- lubridate::now()
        submissions_data(current_data)
      }

      output$update_message <- renderText(result)
    })

    # UI state outputs
    output$selected_id <- renderText({
      selected_data <- selected_row()
      if (!is.null(selected_data)) {
        paste("Selected submission:", selected_data$submission_id)
      } else {
        "No submission selected"
      }
    }) %>% bindCache(selected_row())

    output$has_update_message <- reactive(has_update_message())
    outputOptions(output, "has_update_message", suspendWhenHidden = FALSE)
  })
}
