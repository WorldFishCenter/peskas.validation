#' Create a Tabler-styled dismissible alert
#'
#' @param title Alert title
#' @param message Alert message
#' @param type Alert type ("warning", "info", "success", "danger")
#'
#' @return A shiny tag list
alert <- function(title, message, type = "warning") {
  tags$div(
    class = "container-xl", # Match page container
    tags$div(
      class = "alert alert-warning alert-dismissible", # Added alert-dismissible
      role = "alert",
      tags$div(
        class = "d-flex",
        tags$div(
          tags$svg(
            xmlns = "http://www.w3.org/2000/svg",
            width = "24",
            height = "24",
            viewbox = "0 0 24 24",
            fill = "none",
            stroke = "currentColor",
            `stroke-width` = "2",
            `stroke-linecap` = "round",
            `stroke-linejoin` = "round",
            class = "icon alert-icon",
            tags$path(
              stroke = "none",
              d = "M0 0h24v24H0z",
              fill = "none"
            ),
            tags$path(d = "M12 9v4"),
            tags$path(d = "M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"),
            tags$path(d = "M12 16h.01")
          )
        ),
        tags$div(
          tags$h4(
            class = "alert-title",
            title
          ),
          tags$div(
            class = "text-secondary",
            message
          )
        )
      ),
      tags$a(
        class = "btn-close",
        `data-bs-dismiss` = "alert",
        `aria-label` = "close"
      )
    )
  )
}

#' Update validation status
#'
#' @description
#' Updates the validation status of a KoboToolbox submission
#'
#' @param submission_id Character. ID of the submission to update
#' @param validation_status Character. New validation status to set
#' @param asset_id Character. KoboToolbox asset ID
#' @param token Character. Authentication token
#' @param debug Logical. Whether to print debug information
#' @return Character. Status message indicating success or failure
#' @export
update_validation_status <- memoise::memoise(function(submission_id = NULL,
                                                      validation_status = NULL,
                                                      asset_id = NULL,
                                                      token = NULL,
                                                      debug = TRUE) {
  base_url <- paste0("https://kf.kobotoolbox.org/api/v2/assets/", asset_id, "/data/")
  url <- paste0(base_url, submission_id, "/validation_status/")

  req <- httr2::request(url) %>%
    httr2::req_headers(
      Authorization = token,
      "Content-Type" = "application/x-www-form-urlencoded"
    ) %>%
    httr2::req_body_form(`validation_status.uid` = validation_status) %>%
    httr2::req_method("PATCH")

  if (debug) {
    print(req)
  }

  tryCatch(
    {
      response <- httr2::req_perform(req)
      if (httr2::resp_status(response) == 200) {
        return(paste("Validation status correctly updated for the submission", submission_id))
      } else {
        error_body <- httr2::resp_body_json(response)
        return(paste(
          "Error updating validation status. Status code:",
          httr2::resp_status(response),
          "Error message:",
          jsonlite::toJSON(error_body, auto_unbox = TRUE)
        ))
      }
    },
    error = function(e) {
      if (inherits(e, "httr2_http_400")) {
        error_body <- tryCatch(
          {
            httr2::resp_body_json(e$response)
          },
          error = function(e) "Unable to parse error response"
        )
        return(paste(
          "HTTP 400 Bad Request. Error details:",
          jsonlite::toJSON(error_body, auto_unbox = TRUE)
        ))
      } else {
        return(paste("An error occurred:", e$message))
      }
    }
  )
})

#' Generate edit URL
#'
#' @description
#' Generates an edit URL for a KoboToolbox submission
#'
#' @param submission_id Character. ID of the submission to edit
#' @return Character. Edit URL or NULL if generation fails
#' @export
generate_edit_url <- memoise::memoise(function(submission_id) {
  url <- paste0(
    "https://kf.kobotoolbox.org/api/v2/assets/",
    get_pars()$kobo$asset_id,
    "/data/",
    submission_id,
    "/enketo/edit/?return_url=false"
  )

  tryCatch(
    {
      response <- httr2::request(url) %>%
        httr2::req_headers(Authorization = get_pars()$kobo$token) %>%
        httr2::req_perform()

      if (httr2::resp_status(response) == 200) {
        httr2::resp_body_json(response)$url
      } else {
        NULL
      }
    },
    error = function(e) {
      NULL
    }
  )
})


#' Add application dependencies
#' @noRd
add_js_dependencies <- function() {
  htmltools::htmlDependency(
    name = "hexagon-map",
    version = "1.0.0",
    src = system.file("app/www", package = "peskas.malawi.portal"),
    script = "js/hexagon-tooltips.js",
    stylesheet = "css/tooltip-styles.css"
  )
}

#' Get JavaScript functions
#' @noRd
get_js_functions <- function() {
  list(
    hex_tooltip = htmlwidgets::JS("hexagonTooltip"),
    path_tooltip = htmlwidgets::JS("pathTooltip")
  )
}
