export const formatDate = (date: string) => {
    if (!date) return 'Not set';
    
    const transactionDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
  
    if (transactionDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (transactionDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return transactionDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }; 