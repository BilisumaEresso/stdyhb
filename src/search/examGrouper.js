/**
 * Smart grouping for exam image sets
 */

const stringSimilarity = require("string-similarity");

/**
 * Group images by:
 * 1. mediaGroupId (if available)
 * 2. Similar captions (same exam set)
 * 3. Close timestamps (within 5 minutes)
 */
function groupExamImages(images) {
  if (!images || images.length === 0) return [];

  // Filter only image resources
  const imageResources = images.filter((img) => img.fileType === "image");
  if (imageResources.length === 0) return images;

  const groups = [];
  const grouped = new Set();

  for (let i = 0; i < imageResources.length; i++) {
    if (grouped.has(i)) continue;

    const current = imageResources[i];
    const group = [current];
    grouped.add(i);

    // Check for others in same group
    for (let j = i + 1; j < imageResources.length; j++) {
      if (grouped.has(j)) continue;

      const candidate = imageResources[j];

      if (isImageInSameGroup(current, candidate)) {
        group.push(candidate);
        grouped.add(j);
      }
    }

    // If multiple images, create group representation
    if (group.length > 1) {
      groups.push(createGroupRepresentation(group));
    } else {
      groups.push(current);
    }
  }

  // Add non-image resources
  const nonImages = images.filter((img) => img.fileType !== "image");
  return [...groups, ...nonImages];
}

/**
 * Check if two images belong to same exam set
 */
function isImageInSameGroup(image1, image2, timeWindowMinutes = 5) {
  // Already have mediaGroupId
  if (image1.mediaGroupId && image1.mediaGroupId === image2.mediaGroupId) {
    return true;
  }

  // Same channel
  if (image1.channelUsername !== image2.channelUsername) {
    return false;
  }

  // Same caption indicates same exam set
  if (image1.caption && image2.caption) {
    const similarity = stringSimilarity.compareTwoStrings(
      image1.caption.substring(0, 50),
      image2.caption.substring(0, 50),
    );
    if (similarity > 0.85) {
      return true;
    }
  }

  // Close timestamps (within 5 minutes)
  if (image1.messageDate && image2.messageDate) {
    const timeDiff = Math.abs(
      new Date(image1.messageDate) - new Date(image2.messageDate),
    );
    const minutes = timeDiff / (60 * 1000);
    if (minutes <= timeWindowMinutes) {
      return true;
    }
  }

  return false;
}

/**
 * Create a group representation (virtual resource representing multiple images)
 */
function createGroupRepresentation(imageGroup) {
  if (imageGroup.length === 1) return imageGroup[0];

  // Sort by message date or index
  const sorted = [...imageGroup].sort((a, b) => {
    if (a.messageDate && b.messageDate) {
      return (
        new Date(a.messageDate).getTime() - new Date(b.messageDate).getTime()
      );
    }
    return 0;
  });

  const first = sorted[0];

  return {
    _isGrouped: true,
    groupedImages: sorted,
    groupSize: imageGroup.length,

    // Metadata from first image
    _id: first._id,
    fileId: first.fileId,
    fileUniqueId: first.fileUniqueId,
    channelUsername: first.channelUsername,
    messageId: first.messageId,
    isExam: first.isExam,
    tags: first.tags || [],

    // Descriptive title
    fileName: first.caption
      ? `${first.caption.substring(0, 40)}... (${imageGroup.length} pages)`
      : `Exam Set (${imageGroup.length} pages)`,
    caption: first.caption,
    fileType: "image",
    fileSize: imageGroup.reduce((sum, img) => sum + (img.fileSize || 0), 0),
    downloadCount: Math.max(...imageGroup.map((img) => img.downloadCount || 0)),
    messageDate: first.messageDate,
    indexedAt: first.indexedAt,
  };
}

/**
 * Expand grouped resource back to individual images for sending
 */
function expandGroupedResource(groupedResource) {
  if (!groupedResource._isGrouped) {
    return [groupedResource];
  }
  return groupedResource.groupedImages;
}

module.exports = {
  groupExamImages,
  createGroupRepresentation,
  expandGroupedResource,
  isImageInSameGroup,
};
