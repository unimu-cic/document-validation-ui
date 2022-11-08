import myImports from "../api";

const HTTP = myImports.HTTP;

const documentPollDuration = 1000;

const state = {
  loading: true,
  pages: [],
  annotationSets: null,
  annotations: null,
  labels: [],
  documentId: null,
  sidebarAnnotationSelected: null,
  documentAnnotationSelected: null,
  selectedDocument: null,
  recalculatingAnnotations: false,
  editAnnotation: null,
  missingAnnotations: [],
  currentUser: null,
  publicView: process.env.VUE_APP_GUEST_USER_TOKEN == null,
  showError: false,
  errorMessage: null,
  showDocumentError: false,
  rejectedMissingAnnotations: null,
  errorMessageWidth: null
};

const getters = {
  /**
   * Number of pages. If the pages array doesn't exist yet, return 0.
   */
  pageCount: state => {
    if (state.selectedDocument.pages) {
      return state.selectedDocument.pages.length;
    }
    return 0;
  },

  /**
   * Returns the current page
   */
  pageSelected: (state, _, rootState) => {
    if (state.pages) {
      return state.pages[rootState.display.currentPage - 1];
    }
    return null;
  },

  /**
   * Returns a page in the given index
   */
  pageAtIndex: state => index => {
    if (state.selectedDocument && state.selectedDocument.pages) {
      return state.selectedDocument.pages[index];
    }
    return null;
  },

  /**
   * Checks if is to scroll to an annotation in the document
   */
  scrollDocumentToAnnotation: state => {
    return (
      state.documentAnnotationSelected &&
      state.documentAnnotationSelected.scrollTo
    );
  },

  /**
   * Checks if the document is categorized and ready to start the review
   */
  categorizationIsConfirmed: state => {
    if (state.selectedDocument) {
      if (
        state.selectedDocument.is_category_accepted ||
        state.selectedDocument.is_reviewed
      ) {
        return true;
      } else if (!state.selectedDocument.category) {
        return false;
      } else {
        // check if there's any annotation already approved
        const found = state.annotations.find(annotation => {
          return annotation.revised;
        });
        return found != undefined;
      }
    }
    return false;
  },

  /**
   * Gets labels for an annotation set
   */
  labelsInAnnotationSet: state => annotationSet => {
    const labels = [];
    if (annotationSet && annotationSet.labels) {
      annotationSet.labels.map(label => {
        const newLabel = {
          ...label
        };
        labels.push(newLabel);
      });
    }
    return labels;
  },

  /* Checks if annotation is in deleted state */
  isAnnotationDeleted: state => annotation => {
    if (annotation) {
      return annotation.revised && !annotation.is_correct;
    }
    return false;
  },

  /* Checks if the label has annotations to show */
  labelHasAnnotations: (_, getters) => label => {
    const annotations = label.annotations.filter(annotation => {
      return !getters.isAnnotationDeleted(annotation);
    });
    return annotations.length > 0;
  },

  /* Returns the number of accepted annotations in a label */
  numberOfAcceptedAnnotationsInLabel: _ => label => {
    const annotations = label.annotations.filter(annotation => {
      return annotation.revised && annotation.is_correct;
    });
    return annotations.length;
  },

  /**
   * Checks if theres a group of annotation sets and add an index number to them
   */
  numberOfAnnotationSetGroup: state => annotationSet => {
    let found = false;
    let value = 0;
    let index = 0;
    if (state.annotationSets) {
      state.annotationSets.map(annotationSetTemp => {
        if (
          annotationSetTemp.id !== annotationSet.id &&
          annotationSetTemp.label_set.id === annotationSet.label_set.id &&
          annotationSetTemp.label_set.name === annotationSet.label_set.name
        ) {
          found = true;
          index++;
        } else if (
          annotationSetTemp.label_set.id === annotationSet.label_set.id
        ) {
          value = index;
        }
      });
      return found ? `${value + 1}` : "";
    }
  },

  /**
   * Checks if annotation is being edited
   */
  isAnnotationInEditMode:
    state =>
    (annotationId, index = null) => {
      if (state.editAnnotation && annotationId) {
        if (index != null) {
          return (
            state.editAnnotation.id === annotationId &&
            state.editAnnotation.index === index
          );
        }
        return state.editAnnotation.id === annotationId;
      }
    }
};

const actions = {
  startLoading: ({ commit }) => {
    commit("SET_LOADING", true);
  },
  endLoading: ({ commit }) => {
    commit("SET_LOADING", false);
  },
  setDocId: ({ commit }, id) => {
    commit("SET_PAGES", []);
    commit("SET_DOC_ID", id);
  },
  setSidebarAnnotationSelected: ({ commit }, annotation) => {
    commit("SET_ANNOTATION_SELECTED", annotation);
  },
  setAnnotationSets: ({ commit }, annotationSets) => {
    commit("SET_ANNOTATION_SETS", annotationSets);
  },
  setEditAnnotation: ({ commit }, { id, index, label, labelSet }) => {
    const value = {
      id,
      index,
      label,
      labelSet
    };
    commit("SET_EDIT_ANNOTATION", value);
  },
  resetEditAnnotation: ({ commit }) => {
    commit("RESET_EDIT_ANNOTATION");
  },
  setAnnotations: ({ commit }, annotations) => {
    commit("SET_ANNOTATIONS", annotations);
  },
  setLabels: ({ commit }, labels) => {
    commit("SET_LABELS", labels);
  },
  setPages: ({ commit }, pages) => {
    commit("SET_PAGES", pages);
  },
  setSelectedDocument: ({ commit }, document) => {
    commit("SET_SELECTED_DOCUMENT", document);
  },
  setPublicView: ({ commit }, publicView) => {
    commit("SET_PUBLIC_VIEW", publicView);
  },
  startRecalculatingAnnotations: ({ commit }) => {
    commit("SET_RECALCULATING_ANNOTATIONS", true);
  },
  endRecalculatingAnnotations: ({ commit }) => {
    commit("SET_RECALCULATING_ANNOTATIONS", false);
  },
  setMissingAnnotations: ({ commit }, missingAnnotations) => {
    commit("SET_MISSING_ANNOTATIONS", missingAnnotations);
  },
  setCurrentUser: ({ commit }, currentUser) => {
    commit("SET_CURRENT_USER", currentUser);
  },
  setErrorMessage: ({ commit }, message) => {
    if (message) {
      commit("SET_SHOW_ERROR", true);
    } else {
      commit("SET_SHOW_ERROR", false);
    }

    commit("SET_ERROR_MESSAGE", message);
  },
  setDocumentError: ({ commit }, value) => {
    commit("SET_DOCUMENT_ERROR", value);
  },
  setRejectedMissingAnnotations: ({ commit }, annotations) => {
    commit("SET_REJECTED_MISSING_ANNOTATIONS", annotations);
  },
  setErrorMessageWidth: ({ commit }, width) => {
    commit("SET_ERROR_MESSAGE_WIDTH", width);
  },

  /**
   * Actions that use HTTP requests always return the axios promise,
   * so they can be `await`ed (useful to set the `loading` status).
   */
  fetchDocument: async ({
    commit,
    state,
    dispatch
  }, pollDocumentList = false) => {
    let projectId = null;
    let categoryId = null;
    let isRecalculatingAnnotations = false;

    const initialPage = 1;

    dispatch('startLoading');
    dispatch('display/updateCurrentPage', initialPage, {
      root: true
    });

    await HTTP.get(`documents/${state.documentId}/`)
      .then(async response => {
        if (response.data) {
          const annotationSets = response.data.annotation_sets;
          const annotations = [];
          const labels = [];

          // group annotations for sidebar
          annotationSets.forEach(annotationSet => {
            annotationSet.labels.forEach(label => {
              // add annotations to the document array
              annotations.push(...label.annotations);
              // add labels to the labels array
              labels.push(label);
            });
          });

          // load first page
          if (response.data.pages.length > 0) {
            await dispatch("fetchDocumentPage", initialPage);
          }

          // set information on the store
          commit("SET_ANNOTATION_SETS", annotationSets);
          commit("SET_ANNOTATIONS", annotations);
          commit("SET_LABELS", labels);
          commit("SET_SELECTED_DOCUMENT", response.data);

          projectId = response.data.project;
          categoryId = response.data.category;
          // TODO: add this validation to a method
          isRecalculatingAnnotations = response.data.labeling_available !== 1;
        }
      })
      .catch(error => {
        console.log(error, "Could not fetch document details from the backend");
        return;
      });

    if (!state.publicView) {
      await dispatch("fetchMissingAnnotations");
      await dispatch("fetchCurrentUser");

      if (projectId) {
        await dispatch("category/fetchCategories", projectId, {
          root: true
        });
      }
      if (categoryId) {
        await dispatch("category/createAvailableDocumentsList", {
          categoryId,
          user: state.currentUser,
          poll: pollDocumentList
        }, {
          root: true
        });
      }
    }
    if (isRecalculatingAnnotations) {
      commit("SET_RECALCULATING_ANNOTATIONS", true);
      dispatch("pollDocumentEndpoint");
    }
    dispatch('endLoading');

  },

  // Get document page data
  fetchDocumentPage: ({ commit, state }, page) => {
    return HTTP.get(`documents/${state.documentId}/pages/${page}/`)
      .then(response => {
        commit("ADD_PAGE", response.data);
      })
      .catch(error => {
        console.log(error);
      });
  },

  setDocumentAnnotationSelected: (
    { commit },
    { annotation, label, span, scrollTo = false }
  ) => {
    const value = {
      scrollTo,
      id: annotation.id,
      span,
      page: span.page_index + 1,
      labelName: label.name
    };
    commit("SET_DOCUMENT_ANNOTATION_SELECTED", value);
  },

  scrollToDocumentAnnotationSelected: ({ commit }) => {
    commit("SET_DOCUMENT_ANNOTATION_SCROLL", true);
  },

  disableDocumentAnnotationSelected: ({ commit }) => {
    commit("SET_DOCUMENT_ANNOTATION_SELECTED", null);
  },

  createAnnotation: ({ commit }, annotation) => {
    return new Promise(resolve => {
      HTTP.post(`/annotations/`, annotation)
        .then(response => {
          if (response.status === 201) {
            commit("ADD_ANNOTATION", response.data);
            resolve(response.data);
          } else {
            resolve(null);
          }
        })
        .catch(error => {
          resolve(null);
          console.log(error);
        });
    });
  },

  updateAnnotation: ({ commit }, { updatedValues, annotationId }) => {
    return new Promise(resolve => {
      HTTP.patch(`/annotations/${annotationId}/`, updatedValues)
        .then(response => {
          if (response.status === 200) {
            commit("UPDATE_ANNOTATION", response.data);
            resolve(response.data);
          }
        })
        .catch(error => {
          resolve(false);
          console.log(error);
        });
    });
  },

  deleteAnnotation: ({ commit }, { annotationId }) => {
    return new Promise(resolve => {
      HTTP.delete(`/annotations/${annotationId}/`)
        .then(response => {
          commit("DELETE_ANNOTATION", annotationId);
          resolve(true);
        })
        .catch(error => {
          resolve(false);
          console.log(error);
        });
    });
  },

  updateDocument: ({ commit, state }, updatedDocument) => {
    return new Promise(resolve => {
      HTTP.patch(`/documents/${state.documentId}/`, updatedDocument)
        .then(response => {
          if (response.status === 200) {
            // TODO: remove this after implementation in backend for is_category_accepted
            if (updatedDocument.is_category_accepted) {
              response.data.is_category_accepted = true;
            }

            commit("SET_SELECTED_DOCUMENT", response.data);
            resolve(response.status);
          }
        })
        .catch(error => {
          resolve(error);
          console.log(error);
        });
    });
  },

  fetchMissingAnnotations: ({ commit, state }) => {
    return HTTP.get(
      `/missing-annotations/?document=${state.documentId}&limit=100`
    )
      .then(response => {
        commit("SET_MISSING_ANNOTATIONS", response.data.results);
      })
      .catch(error => {
        console.log(error);
      });
  },

  addMissingAnnotations: ({}, missingAnnotations) => {
    return new Promise(resolve => {
      return HTTP.post(`/missing-annotations/`, missingAnnotations)
        .then(response => {
          if (response.status === 201) {
            resolve(true);
          }
        })
        .catch(error => {
          console.log(error);
          resolve(false);
        });
    });
  },

  deleteMissingAnnotation: ({}, id) => {
    return new Promise(resolve => {
      return HTTP.delete(`/missing-annotations/${id}/`)
        .then(response => {
          if (response.status === 204) {
            resolve(true);
          }
        })
        .catch(error => {
          console.log(error);
          resolve(false);
        });
    });
  },

  fetchDocumentStatus: ({
    state
  }) => {
    return new Promise((resolve, reject) => {
      return HTTP.get(
          `documents/${state.documentId}/?fields=status_data,labeling_available`
        )
        .then(response => {
          // TODO: call getter method for this validations
          if (
            response.data.status_data === 2 &&
            response.data.labeling_available === 1
          ) {
            // ready
            return resolve(true)
          } else if (response.data.status_data === 111) {
            // error
            return reject();
          } else {
            // not yet ready
            return resolve(false);
          }
        })
        .catch(error => {
          console.log(error);
        });
    });
  },

  // Get document data
  fetchDocumentData: ({ commit, state }) => {
    return HTTP.get(`documents/${state.documentId}/`)
      .then(response => {
        commit("SET_SELECTED_DOCUMENT", response.data);
      })
      .catch(error => {
        console.log(error);
      });
  },

  fetchCurrentUser: ({ commit }) => {
    return HTTP.get(`/auth/me/`).then(response => {
      commit("SET_CURRENT_USER", response.data.username);
    });
  },

  // TODO: this should be an util method, not an action on this document store
  sleep: duration => {
    new Promise(resolve => setTimeout(resolve, duration));
  },

  pollDocumentEndpoint: ({
    dispatch
  }) => {
    return dispatch("fetchDocumentStatus").then((ready) => {
      if (ready) {
        // Stop document recalculating annotations
        dispatch("endRecalculatingAnnotations");
        dispatch("fetchDocument");
      } else {
        dispatch("sleep", documentPollDuration).then(() =>
          dispatch("pollDocumentEndpoint")
        );
      }
    }).catch((error) => {
      console.log("catch", error);
      dispatch("setDocumentError", true);
    });
  }
};

const mutations = {
  SET_LOADING: (state, loading) => {
    state.loading = loading;
  },
  SET_DOC_ID: (state, id) => {
    if (id !== state.documentId) {
      state.documentId = id;
    }
  },
  ADD_ANNOTATION: (state, annotation) => {
    state.annotations.push(annotation);
    state.annotationSets.map(annotationSet => {
      if (
        annotation.label_set &&
        annotationSet.label_set.id === annotation.label_set.id
      ) {
        annotationSet.labels.map(label => {
          if (annotation.label && annotation.label.id === label.id) {
            const exists = label.annotations.find(
              existingAnnotation => existingAnnotation.id === annotation.id
            );
            if (!exists) {
              label.annotations.push(annotation);
              return;
            }
          }
        });
      }
    });
  },
  UPDATE_ANNOTATION: (state, annotation) => {
    const indexOfAnnotationInAnnotations = state.annotations.findIndex(
      existingAnnotation => existingAnnotation.id === annotation.id
    );
    if (indexOfAnnotationInAnnotations > -1) {
      state.annotations[indexOfAnnotationInAnnotations] = annotation;
    }
    let updatedAnnotation = false;
    state.annotationSets.forEach(annotationSet => {
      if (updatedAnnotation) {
        return;
      }
      annotationSet.labels.forEach(label => {
        const indexOfAnnotationAnnotationSets = label.annotations.findIndex(
          existingAnnotation => existingAnnotation.id === annotation.id
        );
        if (indexOfAnnotationAnnotationSets > -1) {
          label.annotations.splice(
            indexOfAnnotationAnnotationSets,
            1,
            annotation
          );
          updatedAnnotation = true;
          return;
        }
      });
    });
  },
  DELETE_ANNOTATION: (state, annotationId) => {
    const indexOfAnnotationToDelete = state.annotations.findIndex(
      existingAnnotation => existingAnnotation.id === annotationId
    );
    if (indexOfAnnotationToDelete > -1) {
      state.annotations.splice(indexOfAnnotationToDelete, 1);
    }
    let deleted = false;
    state.annotationSets.forEach(annotationSet => {
      if (deleted) {
        return;
      }
      annotationSet.labels.forEach(label => {
        const indexOfAnnotationInLabelToDelete = label.annotations.findIndex(
          existingAnnotation => existingAnnotation.id === annotationId
        );
        if (indexOfAnnotationInLabelToDelete > -1) {
          label.annotations.splice(indexOfAnnotationInLabelToDelete, 1);
          deleted = true;
          return;
        }
      });
    });
  },
  SET_ANNOTATIONS: (state, annotations) => {
    state.annotations = annotations;
  },
  SET_ANNOTATION_SETS: (state, annotationSets) => {
    state.annotationSets = annotationSets;
  },
  SET_LABELS: (state, labels) => {
    state.labels = labels;
  },
  SET_ANNOTATION_SELECTED: (state, annotation) => {
    state.sidebarAnnotationSelected = annotation;
  },
  SET_EDIT_ANNOTATION: (state, editAnnotation) => {
    state.editAnnotation = editAnnotation;
  },
  RESET_EDIT_ANNOTATION: state => {
    state.editAnnotation = null;
  },
  ADD_PAGE: (state, page) => {
    // if we already have the page in the state, update it in
    // the pages array instead of creating a new one
    const existingPageIndex = state.pages.findIndex(
      p => p.number === page.number
    );
    if (existingPageIndex === -1) {
      state.pages.push(page);
    } else {
      state.pages[existingPageIndex] = page;
    }
  },
  SET_PAGES: (state, pages) => {
    state.pages = pages;
  },
  SET_DOCUMENT_ANNOTATION_SELECTED: (state, documentAnnotationSelected) => {
    state.documentAnnotationSelected = documentAnnotationSelected;
  },
  SET_DOCUMENT_ANNOTATION_SCROLL: (state, scrollTo) => {
    if (state.documentAnnotationSelected) {
      state.documentAnnotationSelected.scrollTo = scrollTo;
    }
  },
  SET_SELECTED_DOCUMENT: (state, document) => {
    if (document.is_reviewed === true) {
      state.publicView = true;
    }
    state.selectedDocument = document;

    // this is to handle cache when a document is edited or changed
    state.selectedDocument.downloaded_at = Date.now();
  },
  SET_RECALCULATING_ANNOTATIONS: (state, recalculatingAnnotations) => {
    state.recalculatingAnnotations = recalculatingAnnotations;
  },
  SET_MISSING_ANNOTATIONS: (state, missingAnnotations) => {
    state.missingAnnotations = missingAnnotations;
  },
  SET_CURRENT_USER: (state, currentUser) => {
    state.currentUser = currentUser;
  },
  SET_SHOW_ERROR: (state, value) => {
    state.showError = value;
  },
  SET_ERROR_MESSAGE: (state, message) => {
    state.errorMessage = message;
  },
  SET_DOCUMENT_ERROR: (state, value) => {
    state.showDocumentError = value;
  },
  SET_IMAGE_LOADED: (state, value) => {
    state.imageLoaded = value;
  },
  SET_REJECTED_MISSING_ANNOTATIONS: (state, annotations) => {
    state.rejectedMissingAnnotations = annotations;
  },
  SET_ERROR_MESSAGE_WIDTH: (state, width) => {
    state.errorMessageWidth = width;
  },
  SET_PUBLIC_VIEW: (state, value) => {
    state.publicView = value;
  }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};
