#' Generate content for the validation tab
#'
#' @description
#' This function creates the layout and content for the validation tab of the dashboard.
#'
#' @return A tagList containing the structured content for the validation tab
#'
#' @export
tab_validation_content <- function() {
  tagList(
    page_heading(
      pretitle = "small scale fisheries",
      title = "Validation Portal"
    ),
    page_cards(
      # Authentication Card (when not authenticated)
      conditionalPanel(
        condition = "!output['validation-is_authenticated']",
        tags$div(
          class = "col-md-4",
          card(
            title = "Validation module",
            mod_validation_ui("validation")
          )
        )
      ),
      # Main Content Card (when authenticated)
      conditionalPanel(
        condition = "output['validation-is_authenticated']",
        card(
          title = "Submissions",
          mod_validation_ui("validation")
        )
      )
    )
  )
}


user_ui <- function() {
  tagList(
    tags$div(
      class = "nav-item",
      tags$a(
        href = "#",
        class = "nav-link d-flex lh-1 text-reset p-0",
        `data-bs-toggle` = "modal",
        `aria-label` = "Open validation menu",
        `aria-expanded` = "false",
        `data-bs-target` = "#validation-modal",
        icon_validation(),
      ),
    ),
  )
}

#' Create a modal dialog UI
#'
#' @description
#' Creates a Bootstrap modal dialog with customizable content, header, footer, and styling.
#'
#' @param ... Content to be placed in the modal body.
#' @param id Character. Modal identifier.
#' @param header Character. Modal header text.
#' @param footer Shiny tags. Modal footer content.
#' @param z_index Numeric. Optional z-index for the modal.
#' @param close_icon Logical. Whether to show a close icon.
#' @param width Character. Width of the modal (e.g., "800px" or "90%").
#'
#' @return A shiny.tag object containing the modal structure.
#' @noRd
modal_dialog_ui <- function(...,
                            id = "",
                            header = NULL,
                            footer = NULL,
                            z_index = NULL,
                            close_icon = FALSE,
                            width = "800px") { # Added width parameter with default
  style <- "display: none;"
  close_x <- NULL
  if (!is.null(z_index)) style <- paste(style, "z-index:", z_index, ";")

  if (isTRUE(close_icon)) {
    close_x <- tags$button(
      type = "button",
      class = "btn-close",
      `data-bs-dismiss` = "modal",
      `aria-label` = "Close"
    )
  }

  if (!is.null(header)) {
    header <- tags$div(
      class = "modal-header",
      tags$h5(class = "modal-title", header),
      close_x
    )
  }

  tagList(
    # Add custom CSS for modal width
    tags$head(
      tags$style(sprintf(
        "#%s .modal-dialog { max-width: %s; width: %s; }",
        id, width, width
      ))
    ),
    tags$div(
      id = id,
      class = "modal modal-dialog-centered",
      tabindex = "-1",
      style = style,
      role = "document",
      `data-backdrop` = "static",
      `data-keyboard` = "false",
      tags$div(
        class = "modal-dialog",
        tags$div(
          class = "modal-content",
          tags$div(
            class = "modal-status bg-primary"
          ),
          header,
          tags$div(
            class = "modal-body",
            ...
          ),
          tags$div(
            class = "modal-footer",
            footer
          )
        )
      )
    )
  )
}


#' Create validation modal
#'
#' @return A shiny.tag object containing the validation modal
validation_modal <- function() {
  modal_dialog_ui(
    id = "validation-modal",
    header = "Validation module",
    width = "1000px", # Set desired width here
    close_icon = TRUE,
    mod_validation_ui("validation"),
    footer = tagList(
      tags$button(
        type = "button",
        class = "btn me-auto",
        `data-bs-dismiss` = "modal",
        "Close"
      )
    )
  )
}
